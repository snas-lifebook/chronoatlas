# 블렌더 헤드리스: blender -b --factory-startup -P promo/deck.py -- <deck_dir> <frames>
# 광택 카드 4장(앞면 = deck_tex.py의 t0~t3.png)이 아래에서 떠올라 부채꼴로 펼쳐지는 투명 시퀀스 r_0001.png…(1920×1080, 30fps)
import bpy, math, sys
from mathutils import Vector
d, frames = sys.argv[sys.argv.index('--') + 1], int(sys.argv[sys.argv.index('--') + 2])
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try: sc.render.engine = eng; break
    except TypeError: pass
sc.render.resolution_x, sc.render.resolution_y, sc.render.fps = 1920, 1080, 30
sc.render.film_transparent = True
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.frame_start, sc.frame_end = 1, frames
try: sc.eevee.taa_render_samples = 32
except AttributeError: pass
sc.view_settings.view_transform = 'Standard'
sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
bg = sc.world.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.02, 0.018, 0.016, 1); bg.inputs[1].default_value = 0.6

def card(i):
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object; o.name = f'card{i}'; o.scale = (1.6, 1.1, 1)
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('r', 'BEVEL'); m.affect = 'VERTICES'; m.width = 0.07; m.segments = 8
    m = o.modifiers.new('s', 'SOLIDIFY'); m.thickness = 0.025
    mat = bpy.data.materials.new(f'm{i}'); mat.use_nodes = True; nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']; img = nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(f'{d}/t{i}.png'); nt.links.new(img.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.16
    for k in ('Coat Weight', 'Clearcoat'):
        if k in bsdf.inputs: bsdf.inputs[k].default_value = 0.8; break
    if 'Emission Color' in bsdf.inputs:   # 화면이 어둡게 죽지 않게 앞면을 약간 자체발광
        nt.links.new(img.outputs['Color'], bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value = 0.35
    o.data.materials.append(mat)
    o.rotation_mode = 'XYZ'
    return o

cards = [card(i) for i in range(4)]
# 카메라·조명
bpy.ops.object.camera_add(location=(0, -10.0, 0.6)); cam = bpy.context.object; cam.rotation_euler = (math.radians(88), 0, 0); sc.camera = cam
cam.data.lens = 50
for loc, e, sz in (((-4, -6, 5), 900, 5), ((5, -4, 3), 500, 4), ((0, 4, 3), 700, 6)):
    bpy.ops.object.light_add(type='AREA', location=loc); L = bpy.context.object; L.data.energy = e; L.data.size = sz
    L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
# 반사용 소프트박스(카메라엔 안 보임)
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, -3, 6)); sb = bpy.context.object; sb.rotation_euler = (math.radians(200), 0, 0)
em = bpy.data.materials.new('sb'); em.use_nodes = True; nt = em.node_tree; nt.nodes.remove(nt.nodes['Principled BSDF'])
e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Strength'].default_value = 2.5; nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs[0])
sb.data.materials.append(em); sb.visible_camera = False

def ease(k): return 1 - (1 - k) ** 3
F_IN, F_FAN = int(frames * 0.18), int(frames * 0.55)
for f in range(1, frames + 1):
    for i, o in enumerate(cards):
        k_in = ease(min(1, max(0, (f - i * 3) / F_IN)))
        k_fan = ease(min(1, max(0, (f - F_IN - i * 4) / (F_FAN - F_IN))))
        idle = (f - F_FAN) / 30 if f > F_FAN else 0
        spread = (i - 1.5)
        x = spread * 1.72 * k_fan
        z = -4 * (1 - k_in) + 0.15 - abs(spread) * 0.12 * k_fan + 0.05 * math.sin(idle * 1.6 + i)
        y = abs(spread) * 0.35 * k_fan + i * 0.01 * (1 - k_fan)
        o.location = (x, y, z)
        o.rotation_euler = (math.radians(90 - 18 * (1 - k_in) + 3 * math.sin(idle + i)),
                            math.radians(-spread * 6 * k_fan),
                            math.radians(spread * 10 * k_fan + 25 * (1 - k_in) * (1 if i % 2 else -1)))
        o.keyframe_insert('location', frame=f); o.keyframe_insert('rotation_euler', frame=f)
    cam.location.y = -10.0 + 0.7 * f / frames; cam.keyframe_insert('location', frame=f)
sc.render.filepath = f'{d}/r_'
bpy.ops.render.render(animation=True)
