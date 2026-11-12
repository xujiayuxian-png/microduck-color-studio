"""Stable identities for the 70 official visual assembly instances.

Ids describe assembly instances, never shared geometry. prepare_raster.py also
adds each part's normalized world bounds to the manifest and this catalog.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Check source mesh order to avoid silently attaching labels to another assembly.
PARTS = [
    ("seeed_bearing__configuration__22x16x4", "左机身轴承 1", "body"),
    ("right_shell", "右侧机身外壳", "body"),
    ("banana_pcb_locker", "机身电路板卡扣", "body"),
    ("trunk_base", "机身底座", "body"),
    ("xl330", "左机身舵机 1", "body"),
    ("power_support", "电池支架", "body"),
    ("np_f970", "电池组", "body"),
    ("xl330", "右机身舵机 2", "body"),
    ("left_shell", "左侧机身外壳", "body"),
    ("seeed_bearing__configuration__22x16x4", "右机身轴承 2", "body"),
    ("yaw2roll", "左髋转接座", "left-leg"),
    ("xl330", "左腿舵机 1", "left-leg"),
    ("seeed_bearing__configuration__22x16x4", "左腿轴承 1", "left-leg"),
    ("bearing_roll", "左髋轴承座", "left-leg"),
    ("seeed_bearing__configuration__22x16x4", "左腿轴承 2", "left-leg"),
    ("hip_l", "左髋支架", "left-leg"),
    ("upper_leg_left", "左大腿外壳", "left-leg"),
    ("xl330", "左腿舵机 2", "left-leg"),
    ("upper_leg_rigidity_plate", "左大腿加固板", "left-leg"),
    ("seeed_bearing__configuration__22x16x4", "左腿轴承 3", "left-leg"),
    ("xl330", "左腿舵机 3", "left-leg"),
    ("leg", "左小腿支架", "left-leg"),
    ("xl330", "左腿舵机 4", "left-leg"),
    ("sole_left", "左脚底板", "left-leg"),
    ("foot_left", "左脚", "left-leg"),
    ("seeed_bearing__configuration_default", "左踝轴承 4", "left-leg"),
    ("ankle_left", "左踝外壳", "left-leg"),
    ("neck", "右颈支架", "neck"),
    ("xl330", "颈部舵机 1", "neck"),
    ("xl330", "颈部舵机 2", "neck"),
    ("neck", "左颈支架", "neck"),
    ("neck_pitch", "颈部俯仰支架", "neck"),
    ("seeed_bearing__configuration__22x16x4", "颈部俯仰轴承 1", "neck"),
    ("yaw_roll_motion", "颈部转向座", "neck"),
    ("xl330", "颈部舵机 3", "neck"),
    ("seeed_bearing__configuration__22x16x4", "颈部后轴承 2", "neck"),
    ("seeed_bearing__configuration__22x16x4", "颈部前轴承 3", "neck"),
    ("lens", "摄像头镜片", "head"),
    ("face_part", "脸部面板", "head"),
    ("xl330", "头部左舵机 1", "head"),
    ("jaw_soft", "下颌软垫", "head"),
    ("motor_support", "头部舵机支架", "head"),
    ("top_head_shell", "头顶壳", "head"),
    ("xl330", "头部后舵机 2", "head"),
    ("seeed_bearing__configuration_default", "头部右轴承 1", "head"),
    ("elec_rpi_robot_hat_pcb", "头部控制电路板", "head"),
    ("soft_mouth_top", "上喙软垫", "head"),
    ("noenoeil", "眼睛装饰圈", "head"),
    ("jaw", "下颌", "head"),
    ("bottom_head_shell", "头部下壳", "head"),
    ("m12_lens_holder", "摄像头镜头座", "head"),
    ("pcb__raspberry_pi_zero_2_w", "树莓派计算板", "head"),
    ("speaker", "扬声器", "head"),
    ("yaw2roll", "右髋转接座", "right-leg"),
    ("xl330", "右腿舵机 1", "right-leg"),
    ("bearing_roll", "右髋轴承座", "right-leg"),
    ("seeed_bearing__configuration__22x16x4", "右腿轴承 1", "right-leg"),
    ("hip_l", "右髋支架", "right-leg"),
    ("seeed_bearing__configuration__22x16x4", "右腿轴承 2", "right-leg"),
    ("xl330", "右腿舵机 2", "right-leg"),
    ("seeed_bearing__configuration__22x16x4", "右腿轴承 3", "right-leg"),
    ("upper_leg_rigidity_plate", "右大腿加固板", "right-leg"),
    ("upper_leg_right", "右大腿外壳", "right-leg"),
    ("xl330", "右腿舵机 3", "right-leg"),
    ("xl330", "右腿舵机 4", "right-leg"),
    ("leg", "右小腿支架", "right-leg"),
    ("ankle_right", "右踝外壳", "right-leg"),
    ("sole_right", "右脚底板", "right-leg"),
    ("seeed_bearing__configuration_default", "右踝轴承 4", "right-leg"),
    ("foot_right", "右脚", "right-leg"),
]


def attach_parts(manifest):
    instances = manifest["instances"]
    if len(instances) != len(PARTS):
        raise ValueError(f"Expected {len(PARTS)} assembly instances, got {len(instances)}")
    catalog = []
    for index, (instance, (mesh, label, section)) in enumerate(zip(instances, PARTS), 1):
        if instance["mesh"] != mesh:
            raise ValueError(f"Assembly order changed at p{index:03}: {instance['mesh']} != {mesh}")
        instance.update(id=f"p{index:03}", partIndex=index, label=label,
                        section=section, hardware=instance["group"] == "fixed")
        part = {"id": instance["id"], "index": index, "name": label,
                "mesh": mesh, "section": section, "hardware": instance["hardware"],
                "legacyGroup": instance["group"]}
        if "bounds" in instance:
            part["bounds"] = instance["bounds"]
        catalog.append(part)
    return catalog


def save_parts(manifest, catalog):
    assets = ROOT / "dist/assets"
    (assets / "duck.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    (assets / "parts.json").write_text(
        json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    model = json.loads((ROOT / "dist/assets/duck.json").read_text())
    parts = attach_parts(model)
    save_parts(model, parts)
    print(f"Prepared {len(parts)} independent assembly parts")
