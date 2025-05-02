import { assert, readString } from "../util.js";
import ArrayBufferSlice from "../ArrayBufferSlice";

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
    private static magic = "shark3d_snake_binary";

    public root: {[key: string]: any};
    private offset: number;

    private stringTable = new Map<number, string>();
    private stringCount = 0;

    constructor(private id: string, private sharkData: ArrayBufferSlice) {
        this.parse();
    }

    private parse() {
        this.offset = 0;

        const magic = readString(this.sharkData, this.offset);
        this.offset += SharkFile.magic.length + 1

        const ver = readString(this.sharkData, this.offset)
        this.offset += "2x4".length + 1

        assert(magic === SharkFile.magic && ver === "2x4", `Magic mismatch in Shark3D "${this.id}"`);

        this.root = this.parseNode();
    }

    private parseNode(): any {
        const nodeCount = this.readVariableSizeInt();
        const node: {[key: string]: any} = {};

        for(let i = 0; i < nodeCount; i++) {
            const name = this.retrieveString();
            const code = this.sharkData.createDataView(this.offset, 1).getUint8(0);
            this.offset += 1;

            const type: SharkType = code ? Math.floor(Math.log2(code) + 1) : 0;
            switch(type) {
                case SharkType.EMPTY:
                    node[name] = null;
                    break;
                case SharkType.INT:
                    node[name] = this.readVariableSizeInt();
                    break;
                case SharkType.INT_ARRAY:
                    let integers: number[] = new Array(this.readVariableSizeInt())
                    for(let k = 0; k < integers.length; k++) {
                        integers[k] = this.readVariableSizeInt();
                    }
                    node[name] = integers;
                    break;
                case SharkType.FLOAT:
                    node[name] = this.readBigEndianFloat();
                    break;
                case SharkType.FLOAT_ARRAY:
                    const floats: number[] = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < floats.length; k++) {
                        floats[k] = this.readBigEndianFloat();
                    }

                    node[name] = floats;
                    break;
                case SharkType.STRING:
                    node[name] = this.retrieveString();
                    break;
                case SharkType.STRING_ARRAY:
                    const strings: string[] = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < strings.length; k++) {
                        strings[k] = this.retrieveString();
                    }

                    node[name] = strings;
                    break;
                case SharkType.OBJECT:
                    node[name] = this.parseNode();
                    break;
                case SharkType.OBJECT_ARRAY:
                    const nodes: {[key: string]: any} = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < nodes.length; k++) {
                        nodes[k] = this.parseNode();
                    }
                    node[name] = nodes;
                    break;
                default:
                    assert(false, `Unrecognized code in Shark3D ${this.id}.cdr`);
            }
        }

        return node;
    }

    private readVariableSizeInt(): number {
        const iterationCount = 10;
        const data = this.sharkData.createDataView(this.offset, iterationCount);
        let result = 0;

        for (let i = 0; i < iterationCount; i++) {
            const byte = data.getInt8(i);
            this.offset += 1;

            const content = byte & 0x7F;
            const offset = i * 0x07;

            result |= content << offset;

            if((byte & 0x80) === 0) {
                if(byte & 0x40) {
                    result -= 1 << offset;
                }

                return result;
            }
        }

        assert(false, `Max iterations reached when decoding variable length integer in ${this.id}.cdr`)
    }

    private readBigEndianFloat(): number {
        const val = this.sharkData.createDataView(this.offset, 4).getFloat32(0, false);
        this.offset += 4;

        return val;
    }

    private retrieveString(): string {
        const num = this.readVariableSizeInt();
        const index = this.stringCount - num;
        if(num === 0) {
            this.stringCount++;
        }
        if(this.stringTable.has(index)) {
            return this.stringTable.get(index)!;
        }
        const value = readString(this.sharkData, this.offset);
        this.offset += value.length + 1;

        this.stringTable.set(index, value);
        return value;
    }
}