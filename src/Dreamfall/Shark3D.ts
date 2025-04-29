import { assert, readString } from "../util.js";
import ArrayBufferSlice from "../ArrayBufferSlice";

enum SharkType {
    EMPTY = 0,
    INT,
    INT_ARRAY,
    FLOAT,
    FLOAT_ARRAY,
    STRING,
    STRING_ARRAY,
    ARRAY,
    TREE,
}

export class SharkNode {
    constructor(private content: any, private type: SharkType, private name: string) {
    }

    public logNodeTree(collapsed: boolean = true) {
        if(collapsed) {
            console.groupCollapsed(`${this.name}`)
        } else {
            console.group(`${this.name}`);
        }
            switch(this.type) {
                case SharkType.EMPTY:
                    console.log("");
                    break;
                case SharkType.INT:
                    console.log(this.content);
                    break;
                case SharkType.INT_ARRAY:
                    this.content.forEach((value: number) => {
                        console.log(value);
                    });
                    break;
                case SharkType.FLOAT:
                    console.log(this.content);
                    break;
                case SharkType.FLOAT_ARRAY:
                    this.content.forEach((value: number) => {
                        console.log(value);
                    });
                    break;
                case SharkType.STRING:
                    console.log(this.content);
                    break;
                case SharkType.STRING_ARRAY:
                    this.content.forEach((value: string) => {
                        console.log(value);
                    });
                    break;
                case SharkType.ARRAY:
                case SharkType.TREE:
                    this.content.forEach((node: SharkNode) => {
                        node.logNodeTree(true);
                    });
                    break;
            }
        console.groupEnd();
    }
}

export class Shark3D {
    private static magic = "shark3d_snake_binary";

    private root: SharkNode;
    private offset: number;

    private stringTable = new Map<number, string>();
    private reverseTable = new Map<string, number>();
    private stringCount = 0;

    constructor(private id: string, private sharkData: ArrayBufferSlice) {
        this.parse();
        this.root.logNodeTree(false);
    }

    private parse() {
        this.offset = 0;

        const magic = readString(this.sharkData, this.offset);
        this.offset += Shark3D.magic.length + 1

        const ver = readString(this.sharkData, this.offset)
        this.offset += "2x4".length + 1

        assert(magic === Shark3D.magic && ver === "2x4", `Magic mismatch in Shark3D "${this.id}.cdr"`);

        this.root = new SharkNode(this.parseNodes(), SharkType.ARRAY, "root");
    }

    private parseNodes(): SharkNode[] {
        const nodeCount = this.readVariableSizeInt();
        const nodes: SharkNode[] = new Array(nodeCount);

        for(let i = 0; i < nodeCount; i++) {
            const name = this.retrieveString();
            const code = this.sharkData.createDataView(this.offset, 1).getUint8(0);
            this.offset += 1;

            const type: SharkType = code ? Math.floor(Math.log2(code) + 1) : 0;
            switch(type) {
                case SharkType.EMPTY:
                    nodes[i] = new SharkNode(null, type, name);
                    break;
                case SharkType.INT:
                    nodes[i] = new SharkNode(this.readVariableSizeInt(), type, name);
                    break;
                case SharkType.INT_ARRAY:
                    let intTable: number[] = new Array(this.readVariableSizeInt())
                    for(let k = 0; k < intTable.length; k++) {
                        intTable[k] = this.readVariableSizeInt();
                    }
                    nodes[i] = new SharkNode(intTable, type, name);
                    break;
                case SharkType.FLOAT:
                    nodes[i] = new SharkNode(this.readBigEndianFloat(), type, name);
                    break;
                case SharkType.FLOAT_ARRAY:
                    const floatTable: number[] = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < floatTable.length; k++) {
                        floatTable[k] = this.readBigEndianFloat();
                    }

                    nodes[i] = new SharkNode(floatTable, type, name);
                    break;
                case SharkType.STRING:
                    nodes[i] = new SharkNode(this.retrieveString(), type, name);
                    break;
                case SharkType.STRING_ARRAY:
                    const stringTable: string[] = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < stringTable.length; k++) {
                        stringTable[k] = this.retrieveString();
                    }
                    nodes[i] = new SharkNode(stringTable, type, name);
                    break;
                case SharkType.ARRAY:
                    nodes[i] = new SharkNode(this.parseNodes(), type, name);
                    break;
                case SharkType.TREE:
                    const nodeTable: SharkNode[] = new Array(this.readVariableSizeInt());
                    for(let k = 0; k < nodeTable.length; k++) {
                        nodeTable[k] = new SharkNode(this.parseNodes(), SharkType.ARRAY, name);
                    }
                    nodes[i] = new SharkNode(nodeTable, type, name);
                    break;
                default:
                    assert(false, `Unrecognized code in Shark3D ${this.id}.cdr`);
            }
        }

        return nodes;
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