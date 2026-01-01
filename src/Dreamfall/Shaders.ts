import {DeviceProgram} from "../Program";
import {GfxShaderLibrary} from "../gfx/helpers/GfxShaderLibrary";


export class StandardProgram extends DeviceProgram {
    public override vert: string = `
layout(location = 0) in vec3 a_Position;
layout(location = 1) in vec3 a_Normal;
layout(location = 2) in vec2 a_TexCoord;

out vec3 v_Normal;
out vec3 v_Position;
out vec2 v_TexCoord;

${GfxShaderLibrary.MatrixLibrary}

void main() {

}
`;
}