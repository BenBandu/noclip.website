import ArrayBufferSlice from "../ArrayBufferSlice";
import {BinaryReader} from "./Utils";
import {Endianness} from "../endian";

export enum SharkType {
    EMPTY        = 0x00,
    INT          = 0x01,
    INT_ARRAY    = 0x02,
    FLOAT        = 0x04,
    FLOAT_ARRAY  = 0x08,
    STRING       = 0x10,
    STRING_ARRAY = 0x20,
    OBJECT       = 0x40,
    OBJECT_ARRAY = 0x80,
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

    public root: {[key: string]: any};
    private stringTable = new Map<number, string>();
    private stringCount = 0;

    constructor(data: ArrayBufferSlice) {
        this.parse(data);
    }

    public getAsObject() {
        console.assert(this.root !== undefined);
        return this.root;
    }

    private parse(data: ArrayBufferSlice) {
        const br = new BinaryReader(data, Endianness.BIG_ENDIAN)

        const magic = br.string0();
        const version = br.string0();
        console.assert(magic === 'shark3d_snake_binary' && version === "2x4");

        this.root = this.parseNode(br);
    }

    private parseNode(br: BinaryReader): any {
        const nodeCount = br.variableInt();
        const node: {[key: string]: any} = {};

        for(let i = 0; i < nodeCount; i++) {
            const name = this.retrieveString(br);
            const type = br.uint8();

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
                    console.assert(false);
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