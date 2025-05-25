import * as Viewer from '../viewer.js';
import {SceneDesc, SceneGfx} from '../viewer.js';
import {GfxDevice} from "../gfx/platform/GfxPlatform";
import {SceneContext} from "../SceneBase";
import {PakArchive} from "./PakArchive";
import {SharkFile} from "./SharkFile";
import {EmptyScene} from "../Scenes_Test";
import {Bundle, ModelInfo} from "./Bundle";
import {assert} from "../util";
import {LocationInit, LoadTree, Entity} from "./Types";
import {DeviceProgram} from "../Program";

export class DreamfallSceneDesc implements SceneDesc {
    private static basePath: string = `Dreamfall/bin/res`;
    private pak: PakArchive;
    private bundle: Bundle;
    private placements: {[key: string]: number[]} = {};
    private entities: Entity[] = [];
    private models: ModelInfo[] = [];

    constructor(public id: string, public name: string) {
    }

    public async createScene(device: GfxDevice, sceneContext: SceneContext): Promise<SceneGfx> {
        this.pak = new PakArchive(this.id, await sceneContext.dataFetcher.fetchData(`${DreamfallSceneDesc.basePath}/${this.id}.pak`));
        const level = new SharkFile(this.id, this.pak.getFileData(`data/generated/locations/${this.id}.cdr`)!);
        this.prepareLevel(level.root);

        // SharkFiles hold multiple different structures
        // Consider separate implementations for each of these instead of generic class?
        // .cdr = Capsule Definition Resource? - Has Level Initialization Data
        // .sir = Scene Index Resource? - Has Model Tree data
        // .spr = Scene Position Resource? - Has Model position data?
        // .smr = Scene Model Resource?  - Don't seem to exist in pak, but might be part of the bundle
        // .bpr = Binary Pose Resource? - Animation files
        // .sdr = Shader Directory Resource? - Seems to be some shader container with various shader variations?
        // .sgr = Shader Graph Resource? - contains asm frag/vert shader references
        // .scr = Shader Code Resource? - contains actual d3d9 shader asm?
        // .ikr = IK Resource? - contains IK data?

        return new EmptyScene();
    }

    private prepareLevel(level: any) {
        console.log(level);
        const children = level.actor_param!.child_param!.children;

        for(const child of children) {
            const [src, type] = child.type.split('.');
            switch(type) {
                case 'locationinit':
                    this.initLocation(child.param);
                    break;
                case 'loadtree':
                    this.loadTree(child.param);
                    break;
                default:
                // Do nothing
            }
        }

        console.log(this.entities);
        console.log(this.models);

        return;
        /*
        // Find shaders used by instances
        const shaderContainers: {[key: string]: any} = {};
        const modelShaders = [];
        for(const model of instances) {
            if(!model.shader) {
                modelShaders.push(null);
                continue;
            }

            const [path, name] = model.shader.split('#');

            if(!shaderContainers.hasOwnProperty(path)) {
                const shaderContainer = new SharkFile(model.name, this.pak.getFileData(path)!);
                console.log(shaderContainer.root);
                shaderContainers[path] = Array.isArray(shaderContainer.root.shaders)
                    ? shaderContainer.root.shaders
                    : [shaderContainer.root.shaders];
            }

            let shader = shaderContainers[path].find((shader: any) => shader.name === name);
            assert(shader !== undefined);
            modelShaders.push(shader);
        }

        // Find Compiled d3d9 assembly vert/frag-shaders
        const programs: {[key: string]: any} = {};
        for(const shader of modelShaders) {
            if(shader === null) {
                continue;
            }

            let params = null;
            if(shader.param.hasOwnProperty('passes')) {
                params = shader.param;
            } else if(shader.param.hasOwnProperty('children')) {
                const platform = shader.param.children.find((child: any) => !child.hasOwnProperty('plat_pat'));
                const [factory, type] = platform.child_type.split('|');
                if(type === 'variants') {
                    params = platform.child_param.children[0].param;
                } else {
                    params = platform.child_param;
                }
            } else {
                params = {passes: [shader.param]};
            }

            const passes = Array.isArray(params.passes) ? params.passes : [params.passes];
            for(let pass of passes) {
                if(!pass.hasOwnProperty('shaderprog')) {
                    continue;
                }

                if(programs.hasOwnProperty(pass.shaderprog)) {
                    continue;
                }

                let prog = new SharkFile(pass.shaderprog, this.pak.getFileData(pass.shaderprog)!);
                let fs = prog.root.d3d9_asm.fragshader;
                let fs_code = Array.isArray(fs.code_variant_array)
                    ? fs.code_variant_array[0].code
                    : fs.code_variant_array.code;

                let vs = prog.root.d3d9_asm.vertshader;
                let vs_code = Array.isArray(vs.code_variant_array)
                    ? vs.code_variant_array[0].code
                    : vs.code_variant_array.code;

                let frag = this.pak.getFileData(fs_code)!;
                let vert = this.pak.getFileData(vs_code)!;

                programs[pass.shaderprog] = {
                    fs: frag,
                    vs: vert,
                };
            }
        }
        */
    }

    private initLocation(params: LocationInit) {
        // Bundled render data (vertex buffers, descriptors, textures, etc...)
        this.bundle = new Bundle(this.pak.getFileData(params.bundle)!);

        if(params.placement_point_names && params.placement_point_transfs) {
            for(let i = 0; i < params.placement_point_names.length; i++) {
                let placementName = params.placement_point_names[i];
                this.placements[placementName] = params.placement_point_transfs.slice(i * 7, i * 7 + 7);
            }
        }

        // TODO: Initialize more of the parameters?
    }

    private loadTree(params: LoadTree) {
        if(params.state === '^state_display') {
            // Return if meant for inventory
            return;
        }

        let filepath = params.tree.split('.')[0];

        const tree = new SharkFile(params.name, this.pak.getFileData(params.tree)!);
        let entities: any = tree.root.data.root.child_array
        if(!entities) {
            return;
        }

        if(!Array.isArray(entities)) {
            entities = [entities];
        }

        for(let entity of entities) {
            this.entities.push(entity);

            if(entity.model) {
                const model = this.bundle.getModelData(filepath + '.smr', entity.model);
                if(model !== null) {
                    this.models.push(model);
                }
            }
        }
    }
}

const id = "dtlj"
const name = "Dreamfall: The Longest Journey";
const sceneDescs = [
    "Stark - Casablanca",
    new DreamfallSceneDesc("hospital_room",             "Hospital"),
    new DreamfallSceneDesc("castillo_home",             "Castillo Home"),
    new DreamfallSceneDesc('jardin_des_roses',          "Jardin Des Roses"),
    new DreamfallSceneDesc('the_souk',                  "The Souk"),
    new DreamfallSceneDesc('la_place_du_sucre',         "La Place Du Sucre"),
    new DreamfallSceneDesc("olivias_shop",              "Alien The Cat"),
    new DreamfallSceneDesc("the_gym",                   "The Gym"),
    new DreamfallSceneDesc("rezas_apartment_building",  "Apartment Building"),
    new DreamfallSceneDesc('underground_entrance',      "Jiva Entrance"),
    new DreamfallSceneDesc("jiva",                      "Jiva"),
    new DreamfallSceneDesc("interrogation_room",        "EYE Interrogation Room"),

    "Stark - Newport",
    new DreamfallSceneDesc("crossroads",            "Crossroads"),
    new DreamfallSceneDesc("marco_polo",            "MarcoPolo"),
    new DreamfallSceneDesc("victory_hotel",         "Victory Hotel"),
    new DreamfallSceneDesc("victory_hotel_backyard","Victory Hotel Backyard"),
    new DreamfallSceneDesc("fringe_cafe",           "Fringe Cafe"),

    "Stark - Japan",
    new DreamfallSceneDesc("japan_streets",             "WATI City"),
    new DreamfallSceneDesc("reception",                 "WATIcorp Reception"),
    new DreamfallSceneDesc("elevator",                  "WATIcorp Elevator"),
    new DreamfallSceneDesc("damiens_office",            "WATIcorp Offices"),
    new DreamfallSceneDesc("wati_dreamcore",            "WATIcorp Dreamcore"),
    new DreamfallSceneDesc("arboretum",                 "WATIcorp Arboretum"),
    new DreamfallSceneDesc("alley",                     "WATIcorp Alley"),
    new DreamfallSceneDesc("damiens_apartment",         "Damien's Apartment (Day)"),
    new DreamfallSceneDesc("damiens_apartment_night",   "Damien's Apartment (Night)"),

    "Stark - Russia",
    new DreamfallSceneDesc("russia_outside",    "Street"),
    new DreamfallSceneDesc("russia_inside",     "Factory"),

    "Stark - Tibet",
    new DreamfallSceneDesc("tibet",         "Temple"),
    new DreamfallSceneDesc("tibet_exterior","Mountain"),

    "Stark - Travel",
    new DreamfallSceneDesc("vactrax",   "Vactrax"),
    new DreamfallSceneDesc("hydrofoil", "Hydrofoil"),
    new DreamfallSceneDesc("scramjet",  "Scramjet"),

    "Arcadia - Underground",
    new DreamfallSceneDesc("undergroundcave",   "Underground Cave"),
    new DreamfallSceneDesc("necropolis",        "Necropolis"),
    new DreamfallSceneDesc("temple_square",     "Temple Square"),
    new DreamfallSceneDesc("dream_chamber",     "Dream Chamber"),

    "Arcadia - Marcuria",
    new DreamfallSceneDesc("inn_cellar",        "The Journey Man Cellar (Day)"),
    new DreamfallSceneDesc("inn_cellar_night",  "The Journey Man Cellar (Night)"),
    new DreamfallSceneDesc("inn_mainhall_day",  "The Journey Man (Day)"),
    new DreamfallSceneDesc("inn_mainhall_night","The Journey Man (Night)"),
    new DreamfallSceneDesc("outside_inn_day",   "Burrow Crook (Day)"),
    new DreamfallSceneDesc("outside_inn_night", "Burrow Crook (Night)"),
    new DreamfallSceneDesc("tower_square_day",  "Tower Square (Day)"),
    new DreamfallSceneDesc("tower_square_night","Tower Square (Night)"),
    new DreamfallSceneDesc("inside_tower",      "Emissary's Office (Day)"),
    new DreamfallSceneDesc("inside_tower_night","Emissary's Office (Night)"),
    new DreamfallSceneDesc("south_gate_day",    "South Gate (Day)"),
    new DreamfallSceneDesc("south_gate_night",  "South Gate (Night)"),
    new DreamfallSceneDesc("magic_ghetto_day",  "Magic Ghetto"),
    new DreamfallSceneDesc("magic_docks_day",   "Magic Docks"),
    new DreamfallSceneDesc("prison",            "Friars Keep Exterior"),
    new DreamfallSceneDesc("inside_friars_keep","Friars Keep Interior"),

    "Arcadia - Sadir",
    new DreamfallSceneDesc("the_war_garden",    "The War Garden"),
    new DreamfallSceneDesc("the_council_room",  "The Council Room"),

    "Arcadia - The Dark People's City",
    new DreamfallSceneDesc("dark_peoples_city_mothertree",  "Mother Tree"),
    new DreamfallSceneDesc("dark_peoples_city_library",     "Library"),

    "Arcadia - Swamp City",
    new DreamfallSceneDesc("swamp_city",        "Ship Wreck"),
    new DreamfallSceneDesc("swamp_city_town",   "Town"),
    new DreamfallSceneDesc("chawans_hut",       "Chawan's Hut"),

    "Arcadia - Travel",
    new DreamfallSceneDesc("airship", "Airship"),

    "In-Between Worlds",
    new DreamfallSceneDesc("guardians_realm",   "The Guardian's Realm"),
    new DreamfallSceneDesc("the_winter",        "The Winter"),
    new DreamfallSceneDesc("winter_past",       "Winter Past"),
];

export const sceneGroup: Viewer.SceneGroup = {id, name, sceneDescs}