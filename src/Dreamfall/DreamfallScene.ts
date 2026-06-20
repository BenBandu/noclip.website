import {SharkFile} from "./SharkFile";
import {PakArchive} from "./PakArchive";
import {Bundle} from "./Bundle";
import {SceneContext} from "../SceneBase";
import {mat4, ReadonlyQuat, ReadonlyVec3} from "gl-matrix";
import {ViewerRenderInput} from "../viewer";
import {GfxDevice} from "../gfx/platform/GfxPlatform";
import {GfxRenderHelper} from "../gfx/render/GfxRenderHelper";

export class DreamfallScene {
    private archive: PakArchive = new PakArchive();
    public actors: Actor[] = [];

    constructor(public id: string) {
    }

    public async initialize(context: SceneContext) {
        await this.archive.load(this.id, context);

        const sceneParams = this.getSharkFileFromArchive(`data/generated/locations/${this.id}.cdr`);
        console.log('Scene Params: ', sceneParams);
        const children = sceneParams!.actor_param!.child_param!.children;
        let selectpos;

        for(const child of children) {
            let actor: Actor;
            const [scope, type] = child.type.split('.');
            switch(type) {
                case LocationInit.type:
                    actor = new LocationInit();
                    break;
                case LoadTree.type:
                    actor = new LoadTree();
                    break;
                default:
                    continue;
            }

            actor.initActor(this, child.param);
            this.actors.push(actor);
        }
    }

    public getFileFromArchive(filepath: string) {
        return this.archive.getFile(filepath);
    }


    public getSharkFileFromArchive(filepath: string) {
        const data = this.getFileFromArchive(filepath);
        if(data === null) return null;

        return new SharkFile(data)!.getAsObject();
    }


    public getActorByName(name: string) {
        return this.actors.find((a) => a.getName() === name);
    }
}

abstract class Actor {
    abstract getName(): string
    abstract initActor(scene: DreamfallScene, params: any): void
    abstract render(device: GfxDevice, viewerInput: ViewerRenderInput): void
    abstract destroy(device: GfxDevice): void;
}


export class LocationInit extends Actor {
    static type = 'locationinit';

    private bundle: Bundle;
    private placementPoints: {[key: string]: mat4} = {};

    /*
    params: {
        adjacent_locations: string[]
        ambient_sounds: {
            enable: number
            id: number
            looped: boolean
            no_stream: boolean
            reverb_dry: boolean
            reverb_wet: boolean
            soundclass: boolean
            subwoofer: boolean
            volume: number
            wave: string
        }[]
        bpr_files?: string[]
        bundle: string
        env_slot_0: string
        env_slot_1: string
        env_slot_2: string
        gui_textures: string
        hacking_game: boolean
        lockpick_game: boolean
        placement_point_names?: string[]
        placement_point_transfs?: number[]
        sound_default?: {
            event: number
            occlusion_level: number
            reverb_level: number
            sound_group: number
            sound_level: number
        }[],
        sound_group_list?: number[]
        soundlevel_combat?: number
        soundlevel_footsteps?: number
        soundlevel_gui?: number
        soundlevel_music?: number
        soundlevel_sfx?: number
        soundlevel_voice?: number
        waves?: string[]
    }
    */
    override getName() {
        return 'locationinit';
    }

    override initActor(scene: DreamfallScene, params: any) {
        console.log('LocationInit: ', params);

        this.bundle = new Bundle(scene.getFileFromArchive(params.bundle)!);
        // TODO: Upload vertex buffers / index buffers from bundle

        if(params.placement_point_names && params.placement_point_transfs) {
            let names = params.placement_point_names;
            if(!Array.isArray(names)) {
                names = [names];
            }

            const transforms = params.placement_point_transfs;
            console.assert(names.length === transforms.length / 7);

            for(let i = 0; i < params.placement_point_names.length; i++) {
                const offs = i * 7;

                const vec: ReadonlyVec3 = [
                    transforms[offs],
                    transforms[offs + 1],
                    transforms[offs + 2]
                ];

                const quat: ReadonlyQuat = [
                    transforms[offs + 3],
                    transforms[offs + 4],
                    transforms[offs + 5],
                    transforms[offs + 6]
                ];

                const matrix = mat4.create();
                mat4.fromRotationTranslation(matrix, quat, vec);

                this.placementPoints[names[i]] = matrix;
            }
        }
    }

    override render(device: GfxDevice, viewerInput: ViewerRenderInput) {

    }

    override destroy(device: GfxDevice) {

    }
}

interface PosgenKey {
    time: number;
    pos: [number, number, number],
    rot: [number, number, number, number],
}

interface PosgenPath {
    duration: number;
    timestep: number;
    keyframes: PosgenKey[];
}

export class LoadTree extends Actor {
    static type = 'loadtree';

    /*
    params: {
        default_shader: string
        model_prefix: string
        name: string
        posgen_prefix: string
        state: string
        tree: string
        watch_cmd?: string
        watch_target?: string
    }
    */

    private name: string;
    private entities: Entity[] = [];
    private posgen: {[key: string]: PosgenPath};


    override getName() {
        console.assert(this.name !== undefined);
        return this.name;
    }

    override initActor(scene: DreamfallScene, params: any) {
        this.name = params.name;

        const path = params.tree.split('.')[0];
        const treeParams = scene.getSharkFileFromArchive(`${path}.sir`);
        if(treeParams) {
            let stack: {entityParams: any, parent: Entity|null}[] = [{entityParams: treeParams!.data.root, parent: null}];
            while(stack.length > 0) {
                const node = stack.pop();
                const entityParams = node!.entityParams;
                const parent = node!.parent;

                const entity = new Entity();
                entity.initActor(scene, entityParams);
                entity.parent = parent;
                this.entities.push(entity);

                let children = entityParams!.child_array;
                if(!children) continue;
                if(!Array.isArray(children)) {
                    children = [children];
                }

                for(const child of children) {
                    stack.push({entityParams: child, parent: entity});
                }
             }
        }

        const posgenParams = scene.getSharkFileFromArchive(`${path}.spr`);
        if(posgenParams) {
            this.posgen = {};

            let paths = posgenParams.data.path_array;
            if(!Array.isArray(paths)) {
                paths = [paths];
            }

            for(const path of paths) {
                let posgen: PosgenPath = {
                    duration: path.duration,
                    timestep: path.duration / path.frame_array.length,
                    keyframes: [],
                }

                for(const frame of path.frame_array) {
                    posgen.keyframes.push({
                        time: frame.key,
                        pos: frame.transl,
                        rot: frame.quat,
                    });
                }

                this.posgen[path.name] = posgen;
            }
        }

        console.log(this);

        if(params.state === '^state_display') {
            // Return if meant for inventory
            console.log("Skipping inventory models...")
            return;
        }

        if(params.name === 'instset_volumes') {
            // Return if volumes (TODO: Make toggleable in the future?)
            console.log('Skipping volumes...')
            return;
        }

        if(params.tree.endsWith('_col.sir') || params.tree.endsWith('_colvol.sir')) {
            // return if collision (TODO: Make toggleable in the future?)
            console.log('Skipping collisions...')
            return;
        }
    }


    getPosgenForEntity(entity: Entity, time: number) {
        const posgen = this.posgen[entity.getName()];
        if(!posgen) return null;

        const rangedTime = time % posgen.duration;
        const index = Math.floor(rangedTime / posgen.timestep);

        return posgen.keyframes[index];
    }

    override render(device: GfxDevice, viewerInput: ViewerRenderInput) {
    }

    override destroy(device: GfxDevice) {

    }
}

export class Entity extends Actor {
    name: string;
    model: string;
    shader: string;
    posgen: string;
    matrix: mat4 = mat4.create();
    parent: Entity|null;
    visible: boolean = true;

    // Likely useless for noclip
    reduce: boolean = false;
    collisionMask: number;
    castShadows: boolean = false;

    /* params {
        cast_shadows?: boolean
        ilkint?: number
        model: string
        name: string
        shader?: string
        posgen?: string
        transl?: number[]
        quat?: number[]
        reduce?: boolean
        child_array?: EntityParams[]
       }
     */

    getName(): string {
        console.assert(this.name !== undefined);
        return this.name;
    }

    setLocalTransform(pos: ReadonlyVec3, rot: ReadonlyQuat) {
        mat4.fromRotationTranslation(this.matrix, rot, pos);
    }

    getWorldTransform(out: mat4): mat4 {
        console.assert(this.matrix !== out);
        return this.parent
            ? mat4.multiply(out, this.parent.getWorldTransform(out), this.matrix)
            : mat4.copy(out, this.matrix);
    }

    initActor(scene: DreamfallScene, params: any): void {
        this.name = params.name;

        if(params.model) {
            this.model = params.model;
            this.shader = params.shader;
        }

        if(params.posgen) {
            this.posgen = params.posgen;
        }

        if(params.transl || params.quat) {
            const transl: ReadonlyVec3  = params.transl || [0, 0, 0];
            const quat: ReadonlyQuat = params.quat || [0, 0, 0, 1];
            mat4.fromRotationTranslation(this.matrix, quat, transl);
        }
    }

    render(device: GfxDevice, viewerInput: ViewerRenderInput): void {
        if(!this.visible) {
            return;
        }
    }

    destroy(device: GfxDevice): void {
    }
}