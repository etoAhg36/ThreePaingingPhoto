const gl = require("gl"); // https://npmjs.com/package/gl v4.9.0
const THREE = require("three"); // https://npmjs.com/package/three v0.124.0
const express = require('express');
const getPixels = require("get-pixels");
const { createCanvas } = require('canvas'); // Import the canvas package

console.log("Script starting...");

const app = express();
const port = 1445;

app.listen(port, () => {
    console.log('live on port ' + port);
});

app.get('/test', function (req, res) {
    res.send("OK");
});

// Add global error handler at the top or near your app setup:
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    // Optionally implement logic to log error details or perform cleanup
});

// Replace the /generate route with proper async/await handling
app.get('/generate', async function (req, res) {
    try {
        const img_url = req.query.img;
        const w = parseFloat(req.query.w);
        const h = parseFloat(req.query.h);
        const x = parseFloat(req.query.x);
        const y = parseFloat(req.query.y);
        const z = parseFloat(req.query.z);
        console.log(img_url, w, h, x, y, z);
        // Await the loadPixels promise, so any error is caught here
        const value = await loadPixels(w, h, img_url, x, y, z);
        res.send(toP3(value));
    } catch (error) {
        console.error(error);
        res.status(500).send("ERROR");
    }
});

function loadPixels(w, h, img_url, x, y, z) {
    return new Promise((resolve, reject) => {
        let material, box, image;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#ffffff');

        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) {
                finished = true;
                reject(new Error("getPixels timeout"));
            }
        }, 10000); // 10 seconds timeout

        getPixels(img_url, function (err, pixels) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (err) {
                reject(err);
            } else {
                try {
                    console.log("Start");
                    var texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.shape[0], pixels.shape[1], THREE.RGBAFormat);
                    texture.minFilter = THREE.LinearFilter;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.needsUpdate = true;
                    material = new THREE.MeshBasicMaterial({ map: texture });
                    box = new THREE.Mesh(new THREE.BoxGeometry(), material);
                    box.scale.set(-w, 0.015, h);
                    box.castShadow = true;
                    box.position.set(0, 0, 0);
                    scene.add(box);

                    const light = new THREE.PointLight();
                    light.position.set(3, 3, 5);
                    light.castShadow = true;
                    scene.add(light);

                    const camera = new THREE.PerspectiveCamera();
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                    camera.up.set(0, 0, 1);
                    camera.position.set(x, y, z);
                    camera.lookAt(box.position);
                    scene.add(camera);

                    const renderer = createRenderer({ width: w / h * 1000, height: 1000 });
                    renderer.render(scene, camera);

                    image = extractPixels(renderer.getContext());
                    const d = new Date();
                    console.log("loaded");

                    resolve(image);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

function createRenderer({ height, width }) {
    const canvas = createCanvas(width, height); // Create a proper canvas object
    // Polyfill for addEventListener and removeEventListener
    canvas.addEventListener = () => { };
    canvas.removeEventListener = () => { };

    const glContext = gl(width, height, { preserveDrawingBuffer: true });
    if (!glContext) {
        console.error("Error: gl context is null. Ensure your system has proper OpenGL libraries installed (e.g., libgl1-mesa-glx, libgl1-mesa-dri on Ubuntu) and that headless-gl is supported in your environment.");
        throw new Error(`Unable to create WebGL context with width ${width} and height ${height}`);
    }
    if (!glContext.getShaderPrecisionFormat) {
        glContext.getShaderPrecisionFormat = function (type, precision) {
            return { rangeMin: 0, rangeMax: 0, precision: 0 };
        };
    }

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "high-performance",
        context: glContext,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default PCFShadowMap

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });
    renderer.setRenderTarget(renderTarget);
    return renderer;
}

function extractPixels(context) {
    const width = context.drawingBufferWidth;
    const height = context.drawingBufferHeight;
    const frameBufferPixels = new Uint8Array(width * height * 4);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, frameBufferPixels);
    const pixels = new Uint8Array(width * height * 4);
    for (let fbRow = 0; fbRow < height; fbRow += 1) {
        let rowData = frameBufferPixels.subarray(fbRow * width * 4, (fbRow + 1) * width * 4);
        let imgRow = height - fbRow - 1;
        pixels.set(rowData, imgRow * width * 4);
    }
    return { width, height, pixels };
}

function toP3({ width, height, pixels }) {
    const headerContent = `P3\n${width} ${height}\n255\n`;
    const bytesPerPixel = pixels.length / width / height;

    let output = headerContent;
    for (let i = 0; i < pixels.length; i += bytesPerPixel) {
        for (let j = 0; j < 3; j += 1) {
            output += pixels[i + j] + " ";
        }
        output += "\n";
    }

    return output;
}