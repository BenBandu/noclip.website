import {SceneGfx, ViewerRenderInput} from "../viewer.js";
import {GfxBufferUsage, GfxDevice} from "../gfx/platform/GfxPlatform";
import {GfxRenderHelper} from "../gfx/render/GfxRenderHelper";
import {DreamfallScene} from "./DreamfallScene";
import {makeBackbufferDescSimple, standardFullClearRenderPassDescriptor} from "../gfx/helpers/RenderGraphHelpers";
import {GfxrAttachmentSlot} from "../gfx/render/GfxRenderGraph";


export class DreamfallRenderer implements SceneGfx  {
    private renderHelper: GfxRenderHelper;
    private scene: DreamfallScene;

    constructor(device: GfxDevice, scene: DreamfallScene) {
        this.renderHelper = new GfxRenderHelper(device);
        this.scene = scene;
    }

    render(device: GfxDevice, viewerInput: ViewerRenderInput): void {
        for(const actor of this.scene.actors) {
            actor.render(device, viewerInput);
        }

        return;

        this.renderHelper.debugDraw.beginFrame(
            viewerInput.camera.projectionMatrix, viewerInput.camera.viewMatrix,
            viewerInput.backbufferWidth, viewerInput.backbufferHeight
        );

        const mainColorDesc = makeBackbufferDescSimple(GfxrAttachmentSlot.Color0, viewerInput, standardFullClearRenderPassDescriptor);
        const mainDepthDesc = makeBackbufferDescSimple(GfxrAttachmentSlot.DepthStencil, viewerInput, standardFullClearRenderPassDescriptor);

        const builder = this.renderHelper.renderGraph.newGraphBuilder();
        const mainColorTargetID = builder.createRenderTargetID(mainColorDesc, 'Main Color');
        const mainDepthTargetID = builder.createRenderTargetID(mainDepthDesc, 'Main Depth');

        this.renderHelper.debugDraw.pushPasses(builder, mainColorTargetID, mainDepthTargetID);
    }

    destroy(device: GfxDevice): void {
        this.renderHelper.destroy();
    }
}