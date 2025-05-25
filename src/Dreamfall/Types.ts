interface SoundDefaults {
    event: number,
    occlusion_level: number,
    reverb_level: number,
    sound_group: number,
    sound_level: number,
}

interface AmbientSound {
    enable: number,
    id: number,
    looped: boolean,
    no_stream: boolean,
    reverb_dry: boolean,
    reverb_wet: boolean,
    soundclass: boolean,
    subwoofer: boolean,
    volume: number,
    wave: string,
}

export interface LocationInit {
    adjacent_locations: string[];
    ambient_sounds: AmbientSound[];
    bpr_files?: string[];
    bundle: string;
    env_slot_0: string;
    env_slot_1: string;
    env_slot_2: string;
    gui_textures: string;
    hacking_game: boolean;
    lockpick_game: boolean;
    placement_point_names?: string[];
    placement_point_transfs?: number[];
    sound_default?: SoundDefaults[],
    sound_group_list?: number[],
    soundlevel_combat?: number,
    soundlevel_footsteps?: number,
    soundlevel_gui?: number,
    soundlevel_music?: number,
    soundlevel_sfx?: number,
    soundlevel_voice?: number,
    waves?: string[],
}

export interface LoadTree {
    default_shader: string;
    model_prefix: string;
    name: string;
    posgen_prefix: string;
    state: string;
    tree: string;
    watch_cmd?: string;
    watch_target?: string;
}

export interface Entity {
    cast_shadows?: boolean;
    ilkint?: number;
    model: string;
    name: string;
    shader?: string;
    posgen?: string;
    transl?: number[];
    quat?: number[];
    reduce?: boolean;
    child_array?: Entity[];
}