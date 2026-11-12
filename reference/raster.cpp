// GPU-free rasterizer, run from repository root:
// g++ -std=c++17 -O3 reference/raster.cpp -o reference/raster
// python reference/prepare_raster.py && ./reference/raster && python reference/export_views.py
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <limits>
#include <vector>

struct V {
    float x, y, z;
    V operator+(V b) const { return {x + b.x, y + b.y, z + b.z}; }
    V operator-(V b) const { return {x - b.x, y - b.y, z - b.z}; }
    V operator*(float s) const { return {x * s, y * s, z * s}; }
};
float dot(V a, V b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
V cross(V a, V b) { return {a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x}; }
V norm(V a) { return a * (1/std::sqrt(std::max(1e-20f, dot(a, a)))); }
struct Tri { V p[3], n[3]; float partIndex, reserved; };
static_assert(sizeof(Tri) == 80, "Triangle stream requires twenty float32 values");
float edge(float ax, float ay, float bx, float by, float x, float y) {
    return (x-ax)*(by-ay)-(y-ay)*(bx-ax);
}
unsigned char byte(float value) {
    return static_cast<unsigned char>(std::lround(std::clamp(value, 0.f, 255.f)));
}
bool writeMap(const char* prefix, int frame, const std::vector<unsigned char>& data) {
    char path[120];
    std::snprintf(path, sizeof(path), "reference/%s-%02d.rgba", prefix, frame);
    std::ofstream out(path, std::ios::binary);
    out.write(reinterpret_cast<const char*>(data.data()), data.size());
    return static_cast<bool>(out);
}
int main() {
    std::ifstream input("reference/triangles.bin", std::ios::binary);
    char magic[4]; unsigned count = 0; V lower{}, upper{};
    input.read(magic, 4);
    input.read(reinterpret_cast<char*>(&count), 4);
    input.read(reinterpret_cast<char*>(&lower), sizeof(V));
    input.read(reinterpret_cast<char*>(&upper), sizeof(V));
    if (!input || std::memcmp(magic, "MDP2", 4) || !count) {
        std::fprintf(stderr, "Run python reference/prepare_raster.py first\n"); return 1;
    }
    std::vector<Tri> triangles(count);
    input.read(reinterpret_cast<char*>(triangles.data()), count*sizeof(Tri));
    if (!input) { std::fprintf(stderr, "Incomplete triangle stream\n"); return 1; }
    constexpr int W = 840, H = 840;
    constexpr float PI = 3.14159265358979323846f;
    const V span = upper - lower;
    const V light = norm({.6f, .9f, .7f}), fill = norm({-.5f, .5f, -.5f});
    const float focal = H/(2*std::tan(30*PI/360));
    for (int frame = 0; frame < 24; ++frame) {
        const float theta = frame*PI/12;
        const V eye = {9.f*std::cos(theta), 4.f, 9.f*std::sin(theta)};
        const V forward = norm(V{0, 1.75f, 0} - eye);
        const V right = norm(cross(forward, {0, 1, 0})), up = cross(right, forward);
        std::vector<float> depth(W*H, std::numeric_limits<float>::infinity());
        std::vector<unsigned char> part(W*H, 0);
        std::vector<V> positions(W*H), normals(W*H);
        for (const auto& tr : triangles) {
            float sx[3], sy[3], z[3]; bool behind = false;
            for (int j = 0; j < 3; ++j) {
                V d = tr.p[j] - eye;
                z[j] = dot(d, forward);
                behind |= z[j] <= 0;
                sx[j] = W*.5f + dot(d, right)*focal/z[j];
                sy[j] = H*.5f - dot(d, up)*focal/z[j];
            }
            if (behind) continue;
            float area = edge(sx[0], sy[0], sx[1], sy[1], sx[2], sy[2]);
            if (std::fabs(area) < .001f) continue;
            int minx = std::max(0, int(std::floor(std::min({sx[0], sx[1], sx[2]}))));
            int maxx = std::min(W-1, int(std::ceil(std::max({sx[0], sx[1], sx[2]}))));
            int miny = std::max(0, int(std::floor(std::min({sy[0], sy[1], sy[2]}))));
            int maxy = std::min(H-1, int(std::ceil(std::max({sy[0], sy[1], sy[2]}))));
            for (int y = miny; y <= maxy; ++y) for (int x = minx; x <= maxx; ++x) {
                float a = edge(sx[1], sy[1], sx[2], sy[2], x+.5f, y+.5f)/area;
                float b = edge(sx[2], sy[2], sx[0], sy[0], x+.5f, y+.5f)/area;
                float c = 1-a-b;
                if (a < 0 || b < 0 || c < 0) continue;
                float d = 1/(a/z[0] + b/z[1] + c/z[2]);
                int k = y*W+x;
                if (d >= depth[k]) continue;
                depth[k] = d;
                part[k] = static_cast<unsigned char>(tr.partIndex);
                // Perspective-correct barycentrics for both surface channels.
                a = a/z[0]*d; b = b/z[1]*d; c = c/z[2]*d;
                positions[k] = tr.p[0]*a + tr.p[1]*b + tr.p[2]*c;
                normals[k] = norm(tr.n[0]*a + tr.n[1]*b + tr.n[2]*c);
            }
        }
        std::vector<unsigned char> rgba(W*H*4, 0), positionMap(W*H*4, 0), normalMap(W*H*4, 0);
        const int dirs[8][2] = {{1,0},{-1,0},{0,1},{0,-1},{1,1},{-1,1},{1,-1},{-1,-1}};
        for (int y = 0; y < H; ++y) for (int x = 0; x < W; ++x) {
            int k = y*W+x;
            if (!part[k]) continue;
            float occlusion = 0;
            for (const auto& dir : dirs) for (int radius : {3, 7, 12}) {
                int xx = x + dir[0]*radius, yy = y + dir[1]*radius;
                if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                float delta = depth[k] - depth[yy*W+xx];
                if (delta > .008f && delta < .2f) ++occlusion;
            }
            const V normal = normals[k], position = positions[k];
            // Identical material-neutral printed illumination for all 70 parts.
            float illumination = .48f + .57f*std::max(0.f, dot(normal, light))
                                      + .13f*std::max(0.f, dot(normal, fill));
            rgba[k*4] = byte(illumination*170);
            rgba[k*4+1] = part[k];
            rgba[k*4+2] = byte((1-occlusion*.008f)*255);
            rgba[k*4+3] = 255;
            positionMap[k*4] = byte((position.x-lower.x)/span.x*255);
            positionMap[k*4+1] = byte((position.y-lower.y)/span.y*255);
            positionMap[k*4+2] = byte((position.z-lower.z)/span.z*255);
            positionMap[k*4+3] = 255;
            normalMap[k*4] = byte((normal.x*.5f+.5f)*255);
            normalMap[k*4+1] = byte((normal.y*.5f+.5f)*255);
            normalMap[k*4+2] = byte((normal.z*.5f+.5f)*255);
            normalMap[k*4+3] = 255;
        }
        if (!writeMap("frame", frame, rgba) || !writeMap("position", frame, positionMap)
                                              || !writeMap("normal", frame, normalMap)) {
            std::fprintf(stderr, "Could not write channel maps\n"); return 1;
        }
        std::printf("view %02d rendered: part / illumination / AO / position / normal\n", frame);
        std::fflush(stdout);
    }
}
