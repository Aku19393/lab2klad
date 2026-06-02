
const { Jimp } = require("jimp")
const path = require("path");

function getCenter(c, w) {
    let sx = 0, sy = 0;

    c.pixels.forEach(id => {
        sx += id % w;
        sy += Math.floor(id / w);
    });

    return {
        x: Math.round(sx / c.pixels.length),
        y: Math.round(sy / c.pixels.length)
    };
}
function getBoundingBox(c, w, imgWidth, imgHeight) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    c.pixels.forEach(id => {
        const x = id % w;
        const y = Math.floor(id / w);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    
    const padding = 5; 
    return {
        minX: Math.max(0, minX - padding),
        minY: Math.max(0, minY - padding),
        maxX: Math.min(imgWidth - 1, maxX + padding),
        maxY: Math.min(imgHeight - 1, maxY + padding)
    };
}

function getCompType(c) {
    const len = c.pixels.length;
    const r = c.rSum / len;
    const g = c.gSum / len;
    const b = c.bSum / len;

    if (b > r * 1.2 && b > g * 1.1) return "end";
    if (r > g * 1.5 && r > b * 1.5) return "start";
    if (r > 160 && g > 160 && b > 160) return "arrow";

    return "unknown";
}

function getCompTypeSimple3(c) {
    const len = c.pixels.length;
    const r = c.rSum / len;
    const g = c.gSum / len;
    const b = c.bSum / len;

    if (r > g * 1.5 && r > b * 1.5) return "start";
    if (g > r * 1.3 && g > b * 1.1) return "clover";
    if (r > 150 && g > 150 && b > 150) return "arrow";

    return "unknown";
}

function bezier(p1, cp1, cp2, p2, t) {
    return (
        Math.pow(1 - t, 3) * p1 +
        3 * Math.pow(1 - t, 2) * t * cp1 +
        3 * (1 - t) * Math.pow(t, 2) * cp2 +
        Math.pow(t, 3) * p2
    );
}

function drawLine(img, x1, y1, x2, y2, color) {
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);

    let sx = x1 < x2 ? 1 : -1;
    let sy = y1 < y2 ? 1 : -1;

    let err = dx - dy;

    while (true) {
        if (
            x1 >= 0 && x1 < img.bitmap.width &&
            y1 >= 0 && y1 < img.bitmap.height
        ) {
            const idx = (img.bitmap.width * y1 + x1) << 2;

            img.bitmap.data[idx] = color.r;
            img.bitmap.data[idx + 1] = color.g;
            img.bitmap.data[idx + 2] = color.b;
            img.bitmap.data[idx + 3] = 255;
        }

        if (x1 === x2 && y1 === y2) break;

        const e2 = 2 * err;

        if (e2 > -dy) {
            err -= dy;
            x1 += sx;
        }

        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
    }
}

function drawRect(img, bbox, color) {
    drawLine(img, bbox.minX, bbox.minY, bbox.maxX, bbox.minY, color); // Верхняя грань
    drawLine(img, bbox.minX, bbox.maxY, bbox.maxX, bbox.maxY, color); // Нижняя грань
    drawLine(img, bbox.minX, bbox.minY, bbox.minX, bbox.maxY, color); // Левая грань
    drawLine(img, bbox.maxX, bbox.minY, bbox.maxX, bbox.maxY, color); // Правая грань
}

function drawBezierPath(img, points, color = { r: 0, g: 255, b: 0 }) {
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        const cp1 = { x: p1.x + (p2.x - p1.x) * 0.5, y: p1.y };
        const cp2 = { x: p1.x + (p2.x - p1.x) * 0.5, y: p2.y };

        const STEPS = 40;

        for (let t = 0; t <= STEPS; t++) {
            const t1 = t / STEPS;
            const t2 = (t + 1) / STEPS;

            const x1 = Math.round(bezier(p1.x, cp1.x, cp2.x, p2.x, t1));
            const y1 = Math.round(bezier(p1.y, cp1.y, cp2.y, p2.y, t1));

            const x2 = Math.round(bezier(p1.x, cp1.x, cp2.x, p2.x, t2));
            const y2 = Math.round(bezier(p1.y, cp1.y, cp2.y, p2.y, t2));

            drawLine(img, x1, y1, x2, y2, color);
        }
    }
}

async function solve(fileName, mode) {
    const original = await Jimp.read(fileName);
    const { width, height } = original.bitmap;

    const img = original.clone();

    if (mode === "2") img.blur(2);
    if (mode === "3") img.blur(1);

    const used = new Uint8Array(width * height);
    const components = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) << 2;

            const br =
                (img.bitmap.data[idx] +
                    img.bitmap.data[idx + 1] +
                    img.bitmap.data[idx + 2]) / 3;

            if (br > 50 && !used[y * width + x]) {
                const c = {
                    pixels: [],
                    rSum: 0,
                    gSum: 0,
                    bSum: 0
                };

                const queue = [y * width + x];
                used[y * width + x] = 1;

                while (queue.length > 0) {
                    const curr = queue.shift();

                    c.pixels.push(curr);

                    const cx = curr % width;
                    const cy = Math.floor(curr / width);

                    const cidx = (cy * width + cx) << 2;

                    c.rSum += img.bitmap.data[cidx];
                    c.gSum += img.bitmap.data[cidx + 1];
                    c.bSum += img.bitmap.data[cidx + 2];

                    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dx, dy]) => {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        const ni = ny * width + nx;

                        if (
                            nx >= 0 && nx < width &&
                            ny >= 0 && ny < height &&
                            !used[ni]
                        ) {
                            const nidx = ni << 2;
                            const nbr =
                                (img.bitmap.data[nidx] +
                                    img.bitmap.data[nidx + 1] +
                                    img.bitmap.data[nidx + 2]) / 3;

                            if (nbr > 50) {
                                used[ni] = 1;
                                queue.push(ni);
                            }
                        }
                    });
                }

                if (c.pixels.length > 15) {
                    c.type =
                        mode === "3"
                            ? getCompTypeSimple3(c)
                            : getCompType(c);

                    components.push(c);
                }
            }
        }
    }


    if (mode === "3") {
        const startComp = components.find(c => c.type === "start");
        const clover = components.find(c => c.type === "clover");
        const arrows = components.filter(c => c.type === "arrow");

        if (!startComp) {
            console.log("Старт не найден.");
            return;
        }

        const pathPoints = [getCenter(startComp, width)];
        const visited = new Set([startComp]);

        let currentPos = pathPoints[0];

        for (let i = 0; i < 2; i++) {
            let next = null;
            let minDist = Infinity;

            arrows.forEach(a => {
                if (visited.has(a)) return;

                const p = getCenter(a, width);

                if (p.y > currentPos.y + 10 && Math.abs(p.x - currentPos.x) < 100) {
                    const d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);

                    if (d < minDist) {
                        minDist = d;
                        next = a;
                    }
                }
            });

            if (next) {
                visited.add(next);
                currentPos = getCenter(next, width);
                pathPoints.push(currentPos);
            }
        }

        for (let i = 0; i < 2; i++) {
            let next = null;
            let minDist = Infinity;

            arrows.forEach(a => {
                if (visited.has(a)) return;

                const p = getCenter(a, width);

                if (p.y < currentPos.y - 10 && Math.abs(p.x - currentPos.x) < 150) {
                    const d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);

                    if (d < minDist) {
                        minDist = d;
                        next = a;
                    }
                }
            });

            if (next) {
                visited.add(next);
                currentPos = getCenter(next, width);
                pathPoints.push(currentPos);
            }
        }

        let lastVec = { x: -1, y: 0 };

        for (let i = 0; i < 6; i++) {
            let best = null;
            let maxScore = -Infinity;

            arrows.forEach(a => {
                if (visited.has(a)) return;

                const p = getCenter(a, width);
                const dist = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);

                if (dist < 280) {
                    const vx = (p.x - currentPos.x) / dist;
                    const vy = (p.y - currentPos.y) / dist;

                    const dot = vx * lastVec.x + vy * lastVec.y;
                    const score = dot * 1200 - dist;

                    if (score > maxScore) {
                        maxScore = score;
                        best = { comp: a, pos: p, vec: { x: vx, y: vy } };
                    }
                }
            });

            if (best) {
                visited.add(best.comp);
                currentPos = best.pos;
                pathPoints.push(currentPos);
                lastVec = best.vec;
            }
        }

        if (clover) {
            pathPoints.push(getCenter(clover, width));
        }

        const finalImg = original.clone();

        for (let i = 0; i < pathPoints.length - 1; i++) {
            drawLine(
                finalImg,
                pathPoints[i].x,
                pathPoints[i].y,
                pathPoints[i + 1].x,
                pathPoints[i + 1].y,
                { r: 0, g: 150, b: 255 }
            );
        }

        if (clover) {
            const bbox = getBoundingBox(clover, width, width, height);
            drawRect(finalImg, bbox, { r: 255, g: 0, b: 0 }); // Красная рамка
        }

        await finalImg.write(`result_${path.basename(fileName)}`);
        console.log("simple3 готов");

        return;
    }

    const startComp = components.find(c => c.type === "start");
    const endComp = components.find(c => c.type === "end");
    const arrows = components.filter(c => c.type === "arrow");

    if (!startComp) {
        console.log("Старт не найден.");
        return;
    }

    let currentComp = startComp;
    const visited = new Set([startComp]);
    const pathPoints = [getCenter(startComp, width)];

    for (let i = 0; i < components.length; i++) {
        const currentPos = getCenter(currentComp, width);

        let nextArrow = null;
        let minDist = Infinity;

        arrows.forEach(a => {
            if (visited.has(a)) return;

            const p = getCenter(a, width);
            const d = Math.hypot(p.x - currentPos.x, p.y - currentPos.y);

            if (d < minDist && d < 250) {
                minDist = d;
                nextArrow = a;
            }
        });

        if (nextArrow) {
            currentComp = nextArrow;
            visited.add(nextArrow);

            pathPoints.push(getCenter(nextArrow, width));
        } else {
            if (endComp) {
                const fPos = getCenter(endComp, width);

                if (Math.hypot(fPos.x - currentPos.x, fPos.y - currentPos.y) < 400) {
                    pathPoints.push(fPos);
                }
            }

            break;
        }
    }

    const finalImg = original.clone();

    drawBezierPath(finalImg, pathPoints);

    if (endComp) {
        const bbox = getBoundingBox(endComp, width, width, height);
        drawRect(finalImg, bbox, { r: 255, g: 0, b: 0 }); // Красная рамка
    }

    await finalImg.write(`result_${path.basename(fileName)}`);

    if (mode === "1") console.log("simple1 готов");
    if (mode === "2") console.log("simple2 готов");
}

if (require.main === module) {
    const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Режим (1-simple1, 2-simple2, 3-simple3): ", mode => {
        rl.question("Имя файла: ", file => {
            solve(file, mode).then(() => rl.close());
        });
    });
}

module.exports = { solve };