import { assert, readString } from "../util.js";
import ArrayBufferSlice from "../ArrayBufferSlice";
import {PakArchive} from "./PakArchive";
import {BinaryReader} from "./Utils";

export enum SharkType {
    EMPTY = 0,
    INT,
    INT_ARRAY,
    FLOAT,
    FLOAT_ARRAY,
    STRING,
    STRING_ARRAY,
    OBJECT,
    OBJECT_ARRAY,
}

export class SharkFile {

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

    private static magic = "shark3d_snake_binary";

    public root: {[key: string]: any};
    private stringTable = new Map<number, string>();
    private stringCount = 0;

    constructor(private id: string, data: ArrayBufferSlice) {
        this.parse(data);
    }

    public static fetch(path: string, archive: PakArchive): any | null {
        const data = archive.getFile(path);
        if(data === null) {
            return null;
        }

        let file = new SharkFile(path, data);
        return file.root;
    }

    private parse(data: ArrayBufferSlice) {
        const br = new BinaryReader(data, false)

        const magic = br.string0();
        const version = br.string0();
        assert(magic === SharkFile.magic && version === "2x4", `Magic mismatch in Shark3D`);

        this.root = this.parseNode(br);
    }

    private parseNode(br: BinaryReader): any {
        const nodeCount = br.variableInt();
        const node: {[key: string]: any} = {};

        for(let i = 0; i < nodeCount; i++) {
            const name = this.retrieveString(br);
            const code = br.uint8();

            const type: SharkType = code ? Math.floor(Math.log2(code) + 1) : 0;
            switch(type) {
                case SharkType.EMPTY:
                    node[name] = null;
                    break;
                case SharkType.INT:
                    node[name] = br.variableInt();
                    break;
                case SharkType.INT_ARRAY:
                    let integers: number[] = new Array(br.variableInt())
                    for(let k = 0; k < integers.length; k++) {
                        integers[k] = br.variableInt();
                    }
                    node[name] = integers;
                    break;
                case SharkType.FLOAT:
                    node[name] = br.float32();
                    break;
                case SharkType.FLOAT_ARRAY:
                    const floats: number[] = new Array(br.variableInt());
                    for(let k = 0; k < floats.length; k++) {
                        floats[k] = br.float32();
                    }

                    node[name] = floats;
                    break;
                case SharkType.STRING:
                    node[name] = this.retrieveString(br);
                    break;
                case SharkType.STRING_ARRAY:
                    const strings: string[] = new Array(br.variableInt());
                    for(let k = 0; k < strings.length; k++) {
                        strings[k] = this.retrieveString(br);
                    }

                    node[name] = strings;
                    break;
                case SharkType.OBJECT:
                    node[name] = this.parseNode(br);
                    break;
                case SharkType.OBJECT_ARRAY:
                    const nodes: {[key: string]: any} = new Array(br.variableInt());
                    for(let k = 0; k < nodes.length; k++) {
                        nodes[k] = this.parseNode(br);
                    }
                    node[name] = nodes;
                    break;
                default:
                    assert(false, `Unrecognized code in Shark3D ${this.id}.cdr`);
            }
        }

        return node;
    }

    private retrieveString(br: BinaryReader): string {
        const num = br.variableInt();
        const index = this.stringCount - num;
        if(num === 0) {
            this.stringCount++;
        }

        if(this.stringTable.has(index)) {
            return this.stringTable.get(index)!;
        }

        const value = br.string0();
        this.stringTable.set(index, value);

        return value;
    }
}