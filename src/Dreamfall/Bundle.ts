import ArrayBufferSlice from "../ArrayBufferSlice";
import {assert, readString} from "../util";
import {BinaryReader, ESeekBehaviour} from "./Utils";

interface VertexBufferInfo {
    stride: number;
    length: number;
    offset?: number;
    buffer: Uint8Array;
}

interface ModelHeader {
    nameOffset: number;
    scale: number;
    center: number[];
    bounds: number[];
    boneCount: number;
    boneNameOffset: number;
    boneDataOffset: number;
    textureCount: number;
    textureOffset: number;
    meshCount: number;
}

interface MeshHeader {
    magicCount: number;
    magicOffset: number;
    attributeDescriptorOffset: number;
    bitcode: number;
    usage: number;
    indexCount: number;
    indexOffset: number;
    boneUsageCount: number;
    boneUsageOffset: number;
    boneStagesCount: number;
    boneVerticesOffset: number;
    boneIndexOffset: number;
    boneAssignOffset: number;
    xTableCount: number;
    xTableOffset: number;
    tax1Count: number;
    tax1Offset: number;
    tax2Count: number;
    tax2Offset: number;
    tax3Count: number;
    tax3Offset: number;
    texStageCount: number;
    stageVerticesOffset: number;
    stageIndexOffset: number;
    stageUnknownOffset: number;
    stageAssignOffset: number;
    morphTargetCount: number;
    morphTargetOffset: number;
    vertexCount: number;
    indexBonusCount: number;
    indexBonusOffset: number;
    textureCount: number;
}

interface MeshData {
    header: MeshHeader;
    textureOffsets: number[],
    magic: number[],
    indices: Uint16Array,
    vertices?: Int8Array;
    boneUsage: number[],
    boneVertices: number[],
    boneIndices: number[],
    boneAssign: number[],
    tax1: number[],
    tax2: number[],
    tax3: number[],
    xTable: number[],
    stageVertices: number[],
    stageIndices: number[],
    stageUnknown: number[],
    stageAssign: number[],
    bonus1: number[],
    bonus2: number[],
    bonusIndices: number[],
    morphTargetTimes: number[],
    tex: TextureData[],
}

interface ModelData {
    header: ModelHeader;
    name: string;
    bones: BoneData[];
    textures: string[];
    meshes: MeshData[];
}

interface BoneData {
    name: string;
    data: number[];
}

interface TextureData {
    cf1: number,
    cf2: number,
    offset: number,
    unknown: number;
    indices: number[],
}

export interface ModelInfo {
    offset: number;
    name: string;
    vertexBufferIndex: number;
    model: ModelData | null;
}

interface AttributeDescriptor {
    size: number;
    channels: EDeclarationType[];
    count: number;
}

interface FileData {
    offset: number;
    name: string;
    models: ModelInfo[] | null;
}

export enum EDeclarationType {
    None = -1,
    Float1,
    Float2,
    Float3,
    Float4,
    Color,
    UByte4,
    Short2,
    Short4,
    UByte4N,
    Short2N,
    Short4N,
    UShort2N,
    UShort4N,
    UDec3,
    Dec3N,
    Float16_2,
    Float16_4
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
export interface Model {
    name: string;
    vertexBuffers: Uint8Array[];
    attributes: AttributeDescriptor;
    center: Vector3;
    bounds: Vector3;
    bones: any[];
    textures: any[];
    meshes: any[];
}

export class Bundle {
    private vertexOffset: number;
    private modelStartOffset: number;
    public texturesPaths: string[];
    public files: FileData[];
    public file: {[key: string]: any};
    public vertexBuffers: VertexBufferInfo[];
    public attributeDescriptorInfo: AttributeDescriptor[];

    constructor(private data: ArrayBufferSlice) {
        this.parseHeader();
    }

    getModelData(fileName: string, modelName: string): null | ModelInfo {
        const file = this.files.find((file) => fileName === file.name);
        if(!file) {
            return null;
        }

        const model = file.models!.find((model) => model.name === modelName);
        if(!model) {
            return null;
        }

        if(!this.parseMesh(model)) {
            return null;
        }


        if(model.model) {
            const vInfo = this.vertexBuffers[model.vertexBufferIndex];
            const vertices = this.data.createTypedArray(Int8Array, vInfo.offset, vInfo.length);
            for(const mesh of model.model?.meshes) {
                mesh.vertices = vertices;
            }
        }

        return model;
    }

    private parse() {
        const br = new BinaryReader(this.data);

        const textureLength = br.uint32(); // Size of texture block
        this.texturesPaths = Array.from({length: br.uint32()}, (): string => {
            const length = br.uint8();
            return br.string(length + 1, '\x00');
        });

        this.vertexBuffers = Array.from({length: br.uint32()}, (): VertexBufferInfo => {
            const stride = br.uint32();
            const length = br.uint32();
            return {
                stride: stride,
                length: length,
                buffer: br.slice(length).createTypedArray(Uint8Array)
            }
        });

        const dataOffset = br.tell();

        const fileCount = br.uint32();
        const attrCount = br.uint32();
        const unknCount = br.uint32(); // Unused in most(?) files

        const fileOffsets = Array.from({length: fileCount}, (): number => dataOffset + br.uint32())

        const attributeOffsetMap: {[key: number]: number} = {};
        this.attributeDescriptorInfo = Array.from({length: attrCount}, (_, i: number): AttributeDescriptor => {
            attributeOffsetMap[br.tell() - dataOffset] = i;
            return {
                size: br.uint32(),
                channels: Array.from({length: 16}, (): number => br.int32()),
                count: br.int32(),
            }
        });

        const vbIndex = 0;
        for(let i = 0; i < fileCount; i++) {
            br.seek(fileOffsets[i]);
            const name = br.string(0x80, '\x00');
            this.file[name] = [];

            const modelCount = br.uint32();
            const modelOffsets = Array.from({length: modelCount}, (): number => dataOffset + br.uint32());
            for(let j = 0; j < modelCount; j++) {
                br.seek(modelOffsets[j]);

                const nameOffset = br.uint32();
                const scale = br.float32();
                const center: Vector3 = {x: br.float32(), y: br.float32(), z: br.float32()};
                const bounds: Vector3 = {x: br.float32(), y: br.float32(), z: br.float32()};

                // TODO: Figure out if these are ever set
                const unkn1 = Array.from({length: 6}, () => br.uint32());

                const boneCount = br.uint32();
                const boneNameOffset = dataOffset + br.uint32();
                const boneDataOffset = dataOffset + br.uint32();

                const textureCount = br.uint32();
                const textureOffset = dataOffset + br.uint32();

                const unkn2 = Array.from({length: 2}, () => br.uint32());

                const meshCount = br.uint32();
                const meshOffsets = Array.from({length: meshCount}, (): number => dataOffset + br.uint32());

                const name = br.string0()

                // TODO: Read Bones
                // TODO: Read Textures

                // Read Meshes
                for(let k = 0; k < meshCount; k++) {
                    br.seek(meshOffsets[k]);
                    br.seek(72, ESeekBehaviour.RELATIVE) // Skip over some sort of separator(?) 0xCF * 72

                    // TODO: What does magic refer to!?
                    const magicCount = br.uint32();
                    const magicOffset = dataOffset + br.uint32();

                    const attrOffset = br.uint32();
                    let attributes: AttributeDescriptor | null = null;
                    if(attrOffset !== 0) {
                        const attrIndex = attributeOffsetMap[attrOffset];
                        attributes = this.attributeDescriptorInfo[attrIndex];
                    }

                    // TODO: Still not sure what bitcode and usage actually do
                    const bitcode = br.uint32();
                    const usage = br.uint32();

                    const unkn2 = Array.from({length: 2}, () => br.uint32());

                    const indexCount = br.uint32();
                    const indexOffset = dataOffset + br.uint32();

                    const boneUsageCount = br.uint32();
                    const boneUsageOffset = dataOffset + br.uint32();

                    const boneVertexCount = br.uint32();
                    const boneVertexOffset = dataOffset + br.uint32();
                    const boneIndexOffset = dataOffset + br.uint32();
                    const boneAssignOffset = dataOffset + br.uint32();

                    const xTableCount = br.uint32();
                    const xTableOffset = dataOffset + br.uint32();

                    const unkn3 = Array.from({length: 4}, () => br.uint32());

                    const tax1Count = br.uint32();
                    const tax1Offset = dataOffset + br.uint32();
                    const tax2Count = br.uint32();
                    const tax2Offset = dataOffset + br.uint32();
                    const tax3Count = br.uint32();
                    const tax3Offset = dataOffset + br.uint32();

                    const stageCount = br.uint32();
                    const stageVerticesOffset = dataOffset + br.uint32();
                    const stageIndicesOffset = dataOffset + br.uint32();
                    const stageUnknOffset = dataOffset + br.uint32();
                    const stageAssignOffset = dataOffset + br.uint32();

                    const vertexCount = br.uint32();

                    const unkn4 = Array.from({length: 10}, () => br.uint32());

                    const bonusCount = br.uint32();
                    const bonusOffset = dataOffset + br.uint32();

                    const textureCount = br.uint32();
                    const textureOffsets = Array.from({length: textureCount}, () => dataOffset + br.uint32());
                }
            }
        }
    }

    private parseHeader() {
        let data = this.data.createDataView();
        let offset = 0;

        this.vertexOffset = data.getInt32(offset, true) + 4;
        offset += 4;

        const textureCount = data.getInt32(offset, true);
        offset += 4;

        this.texturesPaths = new Array(textureCount);
        for(let i = 0; i < textureCount; i++) {
            offset += 1; // Skip a byte that describes the length, since the strings are null-terminated anyway
            this.texturesPaths[i] = readString(this.data, offset);
            offset += this.texturesPaths[i].length + 1;
        }

        const vertexBufferCount = data.getInt32(offset, true);
        offset += 4;

        this.vertexBuffers = new Array(vertexBufferCount);
        for (let i = 0; i < this.vertexBuffers.length; i++) {
            const stride = data.getInt32(offset, true);
            const length = data.getInt32(offset += 4, true);
            this.vertexBuffers[i] = {
                stride: stride,
                length: length,
                offset: offset += 4,
                buffer: this.data.createTypedArray(Uint8Array, offset, length),
            }

            offset += this.vertexBuffers[i].length;
        }

        this.modelStartOffset = offset;

        const modelCount = data.getUint32(offset, true);
        offset += 4;
        const streamCount = data.getUint32(offset, true);
        offset += 4;

        offset += 4; // Jump over unused/unknown value

        this.files = new Array(modelCount);
        for(let i = 0; i < this.files.length; i++) {
            this.files[i] = {offset: data.getUint32(offset, true), name: "", models: null};
            offset += 4;
        }

        this.attributeDescriptorInfo = new Array(streamCount);

        for(let i = 0; i < this.attributeDescriptorInfo.length; i++) {
            const size = data.getInt32(offset, true);
            offset += 4;

            let channels: EDeclarationType[] = new Array(16);
            for(let j = 0; j < channels.length; j++) {
                channels[j] = data.getInt32(offset, true) as EDeclarationType;
                offset += 4;
            }

            const count = data.getInt32(offset, true) + 1;
            offset += 4;

            this.attributeDescriptorInfo[i] = {
                size: size,
                channels: channels,
                count: count,
            };
        }

        let vertexBufferIndex = 0;
        for(let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            offset = this.modelStartOffset + file.offset;
            file.name = readString(this.data, offset);
            offset += 0x80; // Model name is null terminated, but has 0x80 of space reserved

            const modelCount = data.getInt32(offset, true);
            offset += 4;

            file.models = new Array(modelCount);
            for(let j = 0; j < modelCount; j++) {
                file.models[j] = {
                    offset: data.getUint32(offset, true),
                    name: "",
                    vertexBufferIndex: 0,
                    model: null,
                }

                offset += 4;
            }

            for(let j = 0; j < modelCount; j++) {
                const model = file.models[j];

                offset = this.modelStartOffset + model.offset;
                offset = this.modelStartOffset + data.getInt32(offset, true);

                model.name = readString(this.data, offset);
                model.vertexBufferIndex = vertexBufferIndex;

                offset = this.modelStartOffset + model.offset + 0x54;

                const partCount = data.getInt32(offset, true);
                offset += 4;

                for (let k = 0; k < partCount; k++) {
                    offset = this.modelStartOffset + model.offset + 0x58 + (4 * k);
                    offset = this.modelStartOffset + data.getInt32(offset, true) + 0x50;

                    const descriptorOffset = data.getInt32(offset, true);
                    offset += 4;
                    if(descriptorOffset == 0) {
                        continue;
                    }

                    const bitcode = data.getInt32(offset, true);
                    offset += 4;
                    if(bitcode == 0) {
                        continue;
                    }

                    const unused = data.getInt32(offset, true);
                    offset += 4;

                    // divide offset by 4 to get the data in DWORD size
                    // subtract the amount of files and subtract size of header data
                    // divide the length of the data for each file
                    // which gives us the index into the array
                    const descriptorIndex = (descriptorOffset / 4 - this.files.length - 3) / 18;
                    if(this.attributeDescriptorInfo[descriptorIndex].size != 0) {
                        offset += 0x6C;
                        const size = data.getInt32(offset, true);
                        vertexBufferIndex += size
                    }
                }
            }
        }
    }

    private parseMesh(model: ModelInfo): boolean {
        let baseOffset = this.modelStartOffset + model.offset;
        const headerSize = 88;

        const headerData = this.data.createDataView(baseOffset, headerSize);
        let offset = 0;

        const header: ModelHeader = {
            nameOffset: headerData.getUint32(offset, true),
            scale: 1.0 - headerData.getFloat32(offset += 4, true),
            center: [
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true)
            ],
            bounds: [
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true)
            ],
            boneCount: headerData.getUint32(offset += 28, true), // Skip unknown section
            boneNameOffset: headerData.getUint32(offset += 4, true),
            boneDataOffset: headerData.getUint32(offset += 4, true),
            textureCount: headerData.getUint32(offset += 4, true),
            textureOffset: headerData.getUint32(offset += 4, true),
            meshCount: headerData.getUint32(offset += 12, true), // skip unknown section
        }
        offset += 4;

        if(!header.meshCount) {
            return false;
        }

        baseOffset += headerSize;
        const meshSize =
            4 * header.meshCount +
            model.name.length + 1 +
            68 * header.boneCount +
            4 * header.textureCount;

        const meshData = this.data.createDataView(baseOffset, meshSize);
        offset = 0;

        const mesh: ModelData = {
            header: header,
            name: '',
            bones: [],
            textures: [],
            meshes: [],
        }

        // Skip unused part offset?
        offset += 4 * header.meshCount;

        mesh.name = readString(this.data, baseOffset + offset);
        offset += mesh.name.length + 1;

        const nameLength = 40;
        const dataLength = 28;
        for(let i = 0; i < header.boneCount; i++) {
            const nameOffset = baseOffset + offset + i * nameLength;
            const dataOffset = offset + (nameLength * header.boneCount) + (i * dataLength);

            mesh.bones.push({
                name: readString(this.data, nameOffset),
                data: Array.from({length: 7},
                    (_, j) => meshData.getFloat32(dataOffset + j * 4, true)
                )
            });
        }
        offset += (nameLength + dataLength) * header.boneCount;

        mesh.textures = Array.from({length: header.textureCount},
            (_, i) => {
                const index = meshData.getInt32(offset + i * 4, true);
                return this.texturesPaths[index];
            },
        );
        offset += mesh.textures.length * 4;

        mesh.meshes = Array.from({length: header.meshCount},
            (_, i) => {
                return this.parseSubMesh(baseOffset + offset);
            }
        );

        model.model = mesh;
        return true;
    }

    private parseSubMesh(submeshOffset: number): MeshData {
        const headerSize = 264;
        const meshDataOffset = submeshOffset + headerSize;
        const headerData = this.data.createDataView(submeshOffset, headerSize);
        let offset = 72; // Skip unknown section

        const header: MeshHeader = {
            magicCount: headerData.getInt32(offset, true),
            magicOffset: headerData.getUint32(offset += 4, true),
            attributeDescriptorOffset: headerData.getInt32(offset += 4, true),
            bitcode: headerData.getInt32(offset += 4, true),
            usage: headerData.getInt32(offset += 4, true),
            indexCount: headerData.getInt32(offset += 12, true), // skip unknown section
            indexOffset: headerData.getUint32(offset += 4, true),
            boneUsageCount: headerData.getInt32(offset += 4, true),
            boneUsageOffset: headerData.getUint32(offset += 4, true),
            boneStagesCount: headerData.getInt32(offset += 4, true),
            boneVerticesOffset: headerData.getUint32(offset += 4, true),
            boneIndexOffset: headerData.getUint32(offset += 4, true),
            boneAssignOffset: headerData.getInt32(offset += 4, true),
            xTableCount: headerData.getInt32(offset += 4, true),
            xTableOffset: headerData.getUint32(offset += 4, true),
            tax1Count: headerData.getInt32(offset += 20, true), // skip unknown section
            tax1Offset: headerData.getUint32(offset += 4, true),
            tax2Count: headerData.getInt32(offset += 4, true),
            tax2Offset: headerData.getUint32(offset += 4, true),
            tax3Count: headerData.getInt32(offset += 4, true),
            tax3Offset: headerData.getUint32(offset += 4, true),
            texStageCount: headerData.getInt32(offset += 4, true),
            stageVerticesOffset: headerData.getUint32(offset += 4, true),
            stageIndexOffset: headerData.getUint32(offset += 4, true),
            stageUnknownOffset: headerData.getUint32(offset += 4, true),
            stageAssignOffset: headerData.getUint32(offset += 4, true),
            morphTargetCount: headerData.getInt32(offset += 4, true),
            morphTargetOffset: headerData.getUint32(offset += 4, true),
            vertexCount: headerData.getInt32(offset += 4, true),
            indexBonusCount: headerData.getInt32(offset += 44, true), // skip unknown section
            indexBonusOffset: headerData.getUint32(offset += 4, true),
            textureCount: headerData.getInt32(offset += 4, true),
        };
        offset += 4;

        const meshData = this.data.createDataView(meshDataOffset);
        offset = 0;

        const submesh: MeshData = {
            header: header,
            textureOffsets: [],
            magic: [],
            indices: new Uint16Array(header.indexCount),
            boneUsage: [],
            boneVertices: [],
            boneIndices: [],
            boneAssign: [],
            tax1: [],
            tax2: [],
            tax3: [],
            xTable: [],
            stageVertices: [],
            stageIndices: [],
            stageUnknown: [],
            stageAssign: [],
            morphTargetTimes: [],
            bonus1: [],
            bonus2: [],
            bonusIndices: [],
            tex: [],
        }

        //TODO: These should probably use the Uint32Array (or an equivalent) instead of making js arrays

        submesh.textureOffsets = Array.from({length: header.textureCount},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.textureOffsets.length;

        submesh.magic = Array.from({length: header.magicCount},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.magic.length;

        assert(
            this.modelStartOffset + submesh.header.indexOffset === meshDataOffset + offset,
            `Index offset mismatch, expected offset ${this.modelStartOffset + submesh.header.indexOffset}, actual offset ${meshDataOffset + offset}`
        );

        submesh.indices = this.data.createTypedArray(Uint16Array, meshDataOffset + offset, header.indexCount);
        offset += 2 * submesh.indices.length;

        submesh.boneUsage = Array.from({length: header.boneUsageCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneUsage.length;

        submesh.boneVertices = Array.from({length: header.boneStagesCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneVertices.length;

        submesh.boneIndices = Array.from({length: header.boneStagesCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneIndices.length;

        if(header.boneAssignOffset !== 0) {
            submesh.boneAssign = Array.from({length: header.boneStagesCount},
                (_, i) => meshData.getUint16(offset + i * 2, true)
            );
            offset += 2 * submesh.boneAssign.length;
        }

        submesh.tax1 = Array.from({length: header.tax1Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax1.length;

        submesh.tax2 = Array.from({length: header.tax2Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax2.length;

        submesh.tax3 = Array.from({length: header.tax3Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax3.length;

        assert(
            submesh.header.xTableOffset === 0 || this.modelStartOffset + submesh.header.xTableOffset === meshDataOffset + offset,
            `xTable offset mismatch, expected offset ${this.modelStartOffset + submesh.header.xTableOffset}, actual offset ${meshDataOffset + offset}`
        );

        submesh.xTable = Array.from({length: header.xTableCount},
            (_, i) => meshData.getUint8(offset + i)
        );
        offset += header.xTableCount;

        submesh.stageVertices = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageVertices.length;

        submesh.stageIndices = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageVertices.length;

        if(header.stageUnknownOffset !== 0) {
            submesh.stageUnknown = Array.from({length: header.texStageCount},
                (_, i) => meshData.getInt32(offset + i * 4, true)
            );
            offset += 4 * submesh.stageUnknown.length;
        }

        submesh.stageAssign = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageAssign.length;

        submesh.morphTargetTimes = Array.from({length: header.morphTargetCount},
            (_, i) => meshData.getFloat32(offset + i * 4, true)
        );
        offset += 4 * submesh.morphTargetTimes.length;

        if((header.usage & 1) !== 0) {
            // Colors / Normals?
            submesh.bonus1 = Array.from({length: header.vertexCount * 3},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonus1.length;
        }

        if((header.usage & 2) !== 0) {
            // Colors / Normals?
            submesh.bonus2 = Array.from({length: header.vertexCount * 3},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonus2.length;
        }

        if(header.indexBonusCount !== 0) {
            submesh.bonusIndices = Array.from({length: header.indexBonusCount},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonusIndices.length;
        }

        for(let i = 0; i < header.textureCount; i++) {
            submesh.tex.push({
                cf1: meshData.getUint32(offset, true),
                cf2: meshData.getUint32(offset += 4, true),
                offset: meshData.getUint32(offset += 4, true),
                unknown: meshData.getInt32(offset += 4, true),
                indices: [],
            });
            offset += 4

            assert(
                this.modelStartOffset + submesh.tex[i].offset === meshDataOffset + offset,
                `texture offset mismatch, expected offset ${this.modelStartOffset + submesh.tex[i].offset}, actual offset ${meshDataOffset + offset}`
            );

            submesh.tex[i].indices = Array.from({length: header.texStageCount},
                (_, j) => meshData.getInt32(offset + j * 4, true)
            );
            offset += 4 * submesh.tex[i].indices.length;
        }


        return submesh;
    }
}