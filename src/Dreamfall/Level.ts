import {SharkFile} from "./SharkFile";
import {PakArchive} from "./PakArchive";
import {TreeParams, LocationParams} from "./Types";
import {Bundle, ModelInfo} from "./Bundle";

export class Level {

    private readonly definition: any;
    private path = `data/generated/locations/${this.id}.cdr`;
    private bundle: Bundle;
    private placements: {[key: string]: number[]} = {};
    private entities: any[] = [];
    private models: ModelInfo[] = [];

    constructor(public id: string, private archive: PakArchive) {
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
                default:
                // Do nothing
            }
        }

        for(const model of this.models) {
            const vinfo = this.bundle.vertexBufferInfo[model.vIndex];

            console.log({
                mesh: model.model?.meshes[0],
                stride: vinfo.stride,
                size: vinfo.size,
                infoVertexCount: vinfo.size / vinfo.stride,
                meshVertexCount: model.model?.meshes[0]?.header.vertexCount
            })
        }

        return;
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

        if(params.tree.endsWith('volumes.sir')) {
            // Return if volumes (TODO: Make toggleable in the future?)
            console.log('Skipping volumes...')
            return;
        }

        if(params.tree.endsWith('_col.sir')) {
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
            // If there's only one child object, it won't be placed in an array
            entities = [entities];
        }

        let filepath = params.tree.split('.')[0];
        for(let entity of entities) {
            if(entity.model) {
                const model = this.bundle.getModelData(filepath + '.smr', entity.model);
                if(model !== null) {
                    this.models.push(model);
                }
            } else {
                this.entities.push(entity);
            }
        }
    }
}