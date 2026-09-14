"""Copy one animation between Blender exports without changing other asset data."""
from copy import deepcopy
import json,struct

def read_glb(path):
    data=path.read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data)
    size,kind=struct.unpack_from('<II',data,12);assert kind==0x4e4f534a
    document=json.loads(data[20:20+size]);offset=20+size
    size,kind=struct.unpack_from('<II',data,offset);assert kind==0x004e4942
    assert len(document['buffers'])==1 and 'uri' not in document['buffers'][0]
    return document,bytearray(data[offset+8:offset+8+size])

def replace_animation(destination,source,name):
    target,binary=read_glb(destination);origin,source_binary=read_glb(source)
    clip=deepcopy(next(a for a in origin['animations'] if a['name']==name))
    nodes={node['name']:i for i,node in enumerate(target['nodes']) if 'name' in node}
    accessors={};views={}
    def copy_accessor(index):
        if index in accessors:return accessors[index]
        accessor=deepcopy(origin['accessors'][index]);assert 'sparse' not in accessor
        view_index=accessor['bufferView']
        if view_index not in views:
            view=deepcopy(origin['bufferViews'][view_index]);assert view['buffer']==0
            start=view.get('byteOffset',0);chunk=source_binary[start:start+view['byteLength']]
            binary.extend(b'\0'*((-len(binary))%4));view['byteOffset']=len(binary);binary.extend(chunk)
            views[view_index]=len(target['bufferViews']);target['bufferViews'].append(view)
        accessor['bufferView']=views[view_index]
        accessors[index]=len(target['accessors']);target['accessors'].append(accessor)
        return accessors[index]
    def floats(accessor):
        view=origin['bufferViews'][accessor['bufferView']]
        assert accessor['componentType']==5126 and 'byteStride' not in view
        width={'SCALAR':1,'VEC3':3,'VEC4':4}[accessor['type']]
        offset=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        return list(struct.unpack_from('<'+'f'*(width*accessor['count']),source_binary,offset)),width
    paths={c['sampler']:c['target']['path'] for c in clip['channels']}
    for sampler_index,sampler in enumerate(clip['samplers']):
        assert sampler['interpolation']=='CUBICSPLINE'
        times,_=floats(origin['accessors'][sampler['input']])
        output=deepcopy(origin['accessors'][sampler['output']]);data,width=floats(output)
        assert output['count']==len(times)*3
        values=[data[(i*3+1)*width:(i*3+2)*width] for i in range(len(times))]
        if paths[sampler_index]=='rotation':
            # Blender's bone-space conversion can change quaternion sign. Cubic
            # interpolation must keep each value and its tangents in one hemisphere.
            for i in range(1,len(values)):
                if sum(a*b for a,b in zip(values[i-1],values[i]))<0:values[i]=[-v for v in values[i]]
        assert max(abs(a-b) for a,b in zip(values[0],values[-1]))<1e-4,'Expected a closed walking loop'
        values[-1]=values[0][:]
        packed=[];period=times[-1]-times[0]
        for i,value in enumerate(values):
            prev=i-1 if i>0 else len(values)-2;following=i+1 if i<len(values)-1 else 1
            dt=times[following]-times[prev]
            if dt<0:dt+=period
            tangent=[(b-a)/dt for a,b in zip(values[prev],values[following])]
            if paths[sampler_index]=='rotation':
                projection=sum(a*b for a,b in zip(value,tangent))
                tangent=[v-projection*q for v,q in zip(tangent,value)]
            packed.extend(tangent+value+tangent)
        binary.extend(b'\0'*((-len(binary))%4));offset=len(binary)
        binary.extend(struct.pack('<'+'f'*len(packed),*packed))
        output['bufferView']=len(target['bufferViews']);output['byteOffset']=0
        output.pop('min',None);output.pop('max',None)
        target['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(packed)*4})
        sampler['input']=copy_accessor(sampler['input'])
        sampler['output']=len(target['accessors']);target['accessors'].append(output)
    for channel in clip['channels']:
        channel['target']['node']=nodes[origin['nodes'][channel['target']['node']]['name']]
    index=next(i for i,a in enumerate(target['animations']) if a['name']==name)
    target['animations'][index]=clip;target['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(target,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    binary.extend(b'\0'*((-len(binary))%4))
    destination.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
