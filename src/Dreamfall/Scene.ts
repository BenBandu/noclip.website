import {SharkFile} from "./SharkFile";
import {PakArchive} from "./PakArchive";
import {TreeParams, LocationParams} from "./Types";
import {Bundle, ModelInfo} from "./Bundle";
import {SceneContext} from "../SceneBase";

export class Scene {
    private readonly definition: any;
    private path = `data/generated/locations/${this.archive.id}.cdr`;
    private bundle: Bundle;
    private placements: {[key: string]: number[]} = {};
    private trees: TreeParams[];
    private scripts: any = {};
    private bookmarks: any = {};
    private selectpositions: any = {};

    constructor(public archive: PakArchive, context: SceneContext) {
        this.definition = SharkFile.fetch(this.path, this.archive);
        this.prepare();
    }

    private prepare() {
        const children = this.definition.actor_param!.child_param!.children;

        for(const child of children) {
            const [scope, type] = child.type.split('.');
            switch(type) {
                case 'locationinit':
                    this.initLocation(child.param as LocationParams);
                    break;
                case 'loadtree':
                    this.loadTree(child.param as TreeParams);
                    break;
                case 'scriptobject':
                    this.scriptObject(child.param);
                    break;
                case 'bookmark':
                    this.bookmark(child.param);
                    break;
                case 'selectpos':
                    this.selectpos(child.param);
                    break;
                default:
                // Do nothing
            }
        }
    }

    private initLocation(params: LocationParams) {
        // Bundled render data (vertex buffers, descriptors, textures, etc...)
        this.bundle = new Bundle(this.archive.getFile(params.bundle)!);

        if(params.placement_point_names && params.placement_point_transfs) {
            for(let i = 0; i < params.placement_point_names.length; i++) {
                let placementName = params.placement_point_names[i];
                this.placements[placementName] = params.placement_point_transfs.slice(i * 7, i * 7 + 7);
            }
        }

        // TODO: Initialize more of the parameters?
    }

    private loadTree(params: TreeParams) {
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

        const tree = SharkFile.fetch(params.tree, this.archive);
        let entities: any = tree.data.root.child_array
        if(!entities) {
            return;
        }

        if(!Array.isArray(entities)) {
            entities = [entities];
        }

        let filepath = params.tree.split('.')[0];
        for(let entity of entities) {
            if(entity.model) {
                const model = this.bundle.getModelData(filepath + '.smr', entity.model);
            }

            if(entity.posgen) {
                const posgen = SharkFile.fetch(filepath + '.spr', this.archive);
            }
        }
    }

    private scriptObject(params: any) {
        if(!(params.runflag in this.scripts))
        {
            this.scripts[params.runflag] = [];
        }

        const script = SharkFile.fetch(params.res, this.archive);

        const combined = {id: params.id, ...script.script};
        this.scripts[params.runflag].push(combined);
    }

    private bookmark(params: any) {
        this.bookmarks[params.id] = params.selectpos_actor;
    }

    private selectpos(param: any) {
        this.selectpositions[param.name] = {actor: param.pos_actor, name: param.pos_name}
    }
}