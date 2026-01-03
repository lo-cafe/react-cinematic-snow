import { Particle } from '../types';
export interface WebGLState {
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    positionBuffer: WebGLBuffer;
    sizeBuffer: WebGLBuffer;
    opacityBuffer: WebGLBuffer;
    seedBuffer: WebGLBuffer;
    rotationBuffer: WebGLBuffer;
    isMobile: boolean;
    locations: {
        position: number;
        size: number;
        opacity: number;
        seed: number;
        rotation: number;
        resolution: WebGLUniformLocation;
        color: WebGLUniformLocation;
        roughness: WebGLUniformLocation;
        layer: WebGLUniformLocation;
        isMobile: WebGLUniformLocation;
    };
}
export declare function initWebGL(canvas: HTMLCanvasElement): WebGLState | null;
export declare function renderWebGL(state: WebGLState, particles: Particle[], width: number, height: number, color: string, globalOpacity: number, layerOpacity: number, roughness: number, layer: number): void;
export declare function isWebGLSupported(): boolean;
