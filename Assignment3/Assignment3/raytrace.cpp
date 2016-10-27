//
// template-rt.cpp
//

#define _CRT_SECURE_NO_WARNINGS
#include "matm.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

int g_width;
int g_height;

struct Ray
{
    vec4 origin;
    vec4 dir;
};
struct Sphere
{
    Sphere(string name, vec4 pos, vec3 scale, vec4 color, float Ka, float Kd, float Ks,
           float Kr, float spec_ex);
    string m_name;
    vec4 m_pos;
    vec3 m_scale;
    vec4 m_color;
    float m_Ka;
    float m_Kd;
    float m_Ks;
    float m_Kr;
    float m_spec_ex;
    
    mat4 m_inverse;
};

//sphere constructor
Sphere::Sphere(string name, vec4 pos, vec3 scale, vec4 color, float Ka, float Kd, float Ks,
               float Kr, float spec_ex)
{
    
    m_name = name;
    m_pos = pos;
    m_scale = scale;
    m_color = color;
    m_Ka = Ka;
    m_Kd = Kd;
    m_Ks = Ks;
    m_Kr = Kr;
    m_spec_ex = spec_ex;
    
    InvertMatrix(Scale(m_scale), m_inverse);
}

struct Light
{
    Light(string name, vec4 pos, vec4 intensity);
    string m_name;
    vec4 m_pos;
    vec4 m_intensity;
};

//light constructor
Light::Light(string name, vec4 pos, vec4 intensity)
{
    m_name = name;
    m_pos = pos;
    m_intensity = intensity;
}

int s_count = 0, l_count =0;


vector<vec4> g_colors;
vec4 g_bColors;
vector<Light> g_light;
vector<Sphere> g_spheres;

float g_left;
float g_right;
float g_top;
float g_bottom;
float g_near;
vec4 g_ambient;
char g_fileName[50];

// -------------------------------------------------------------------
// Input file parsing

vec4 toVec4(const string& s1, const string& s2, const string& s3)
{
    stringstream ss(s1 + " " + s2 + " " + s3);
    vec4 result;
    ss >> result.x >> result.y >> result.z;
    result.w = 1.0f;
    return result;
}

inline vec3 toVec3(vec4 a)
{
    return vec3(a[0], a[1], a[2]);
}

float toFloat(const string& s)
{
    stringstream ss(s);
    float f;
    ss >> f;
    return f;
}

void parseLine(const vector<string>& vs)
{
    const int num_labels = 11;
    const string labels[] = {"NEAR","LEFT","RIGHT","BOTTOM","TOP","RES","SPHERE","LIGHT","BACK","AMBIENT","OUTPUT"};
    unsigned label_id = find(labels, labels+num_labels, vs[0]) - labels;
    switch(label_id)
    {
        case 0:
            g_near = toFloat(vs[1]);
            break;
            
        case 1:
            g_left = toFloat(vs[1]);
            break;
            
        case 2:
            g_right = toFloat(vs[1]);
            break;
            
        case 3:
            g_bottom = toFloat(vs[1]);
            break;
            
        case 4:
            g_top = toFloat(vs[1]);
            break;
            
        case 5:
            g_width = stoi(vs[1]);
            g_height = stoi(vs[2]);
            g_colors.resize((unsigned int) (g_width * g_height));
            break;
            
        case 6:
            if(toFloat(vs[11]) > 1 || toFloat(vs[11]) < 0)
            {
                cout << "ERROR: Ka Must Be Between 0 And 1" << endl;
                break;
            }
            else if(toFloat(vs[12]) > 1 || toFloat(vs[12]) < 0)
            {
                cout << "ERROR: Kd Must Be Between 0 And 1" << endl;
                break;
            }
            else if(toFloat(vs[13]) > 1 || toFloat(vs[13]) < 0)
            {
                cout << "ERROR: Ks Must Be Between 0 And 1" << endl;
                break;
            }
            else if(toFloat(vs[14]) > 1 || toFloat(vs[14]) < 0)
            {
                cout << "ERROR: Kr Must Be Between 0 And 1" << endl;
                break;
            }
            
            if(s_count < 5)
            {
                //send to constructor for sphere
                vec3 v = vec3(toFloat(vs[5]), toFloat(vs[6]), toFloat(vs[7]));
                Sphere s = Sphere(vs[1], toVec4(vs[2],vs[3],vs[4]), v, toVec4(vs[8],vs[9],vs[10]),
                                  toFloat(vs[11]),toFloat(vs[12]),toFloat(vs[13]),
                                  toFloat(vs[14]), toFloat(vs[15]));
                s_count++;
                g_spheres.push_back(s);
            }
            else
                cout << "ERROR: TOO MANY SPHERES" << endl;
            break;
            
        case 7:
            if(l_count < 5)
            {
                //sent to light constructor
                Light l = Light(vs[1], toVec4(vs[2], vs[3], vs[4]), toVec4(vs[5], vs[6], vs[7]));
                l_count++;
                g_light.push_back(l);
            }
            else
                cout << "ERROR: TOO MANY LIGHT SOURCES" << endl;
            break;
            
        case 8:
            g_bColors = toVec4(vs[1], vs[2], vs[3]);
            break;
            
        case 9:
            g_ambient = toVec4(vs[1], vs[2], vs[3]);
            break;
            
        case 10:
            for(int i = 0; i < vs[1].length(); i++)
            {
                g_fileName[i] = vs[1][i];
            }
            break;
    }

}

void loadFile(const char* filename)
{
    ifstream is(filename);
    if (is.fail())
    {
        cout << "Could not open file " << filename << endl;
        exit(1);
    }
    string s;
    vector<string> vs;
    while(!is.eof())
    {
        vs.clear();
        getline(is, s);
        istringstream iss(s);
        while (!iss.eof())
        {
            string sub;
            iss >> sub;
            vs.push_back(sub);
        }
        parseLine(vs);
    }
}


// -------------------------------------------------------------------
// Utilities

void setColor(int ix, int iy, const vec4& color)
{
    int iy2 = g_height - iy - 1; // Invert iy coordinate.
    g_colors[iy2 * g_width + ix] = color;
}


// -------------------------------------------------------------------
// Intersection routine

float intersection(Sphere sp, Ray r, int r_num)
{
    vec4 s = sp.m_inverse * (sp.m_pos - r.origin);
    vec4 c = sp.m_inverse * r.dir;
    vec3 s_p = toVec3(s);
    vec3 c_p = toVec3(c);
    
    float dot_c = dot(c_p, c_p);
    float dot_s = dot(s_p, s_p);
    float dot_sc = dot(c_p, s_p);
    
    float dis = (dot_sc * dot_sc) - (dot_c * (dot_s-1));
    //one solution case
    if(dis == 0)
    {
        float hit = -(dot_sc/dot_c);
        if(hit < 1)
            return -1;
        return hit;
    }
    //zero solution case
    else if (dis < 0)
    {
        return -1;
    }
    //2 solution case
    else if (dis > 0)
    {
        float hit1 = (dot_sc - sqrtf(dis))/dot_c;
        float hit2 = (dot_sc + sqrtf(dis))/dot_c;
        
        //for a reflected or light ray, r_num > 0
        if(r_num > 0)
        {
            //pick the smaller of the two that is greater than 0.0001f
            if(hit1 < hit2 && hit1 >= 0.0001f)
            {
                return hit1;
            }
            else if(hit1 > hit2 && hit2 >= 0.0001f)
            {
                return hit2;
            }
            else
                return -1;
        }
        //for all other rays
        else
        {
            //pick the smaller of the two that is greater than 1
            if(hit1 < hit2 && hit1 >= 1)
            {
                return hit1;
            }
            else if(hit1 > hit2 && hit2 >= 1)
            {
                return hit2;
            }
            else
                return -1;
        }
    }
    return -1;
}

// -------------------------------------------------------------------
// Ray tracing

vec4 trace(const Ray& ray, int r_num)
{
    float closestDistance = INT_MAX; //closest distance to any sphere
    int sphereIndex = 0;
    
    //loop through all the spheres in g_sphere
    for(int i = 0; i < s_count; i++)
    {
        //find the closest intersection for this particualr ray with any sphere
        float a = intersection(g_spheres[i], ray, r_num);
        if(a < closestDistance && a >= 1 && r_num ==0)
        {
            closestDistance = a;
            sphereIndex = i;
        }
        else if(a < closestDistance && a >= 0.0001f)
        {
            closestDistance = a;
            sphereIndex = i;
        }
    }
    //if no sphere is hit and its not a reflected ray, return background color
    if(closestDistance == INT_MAX && r_num == 0)
    {
        return g_bColors;
    }
    else if(closestDistance == INT_MAX )
    {
        return vec4();
    }
    
    //point of intersection for this ray with this sphere
    vec4 intersectionPoint = ray.origin + ray.dir * closestDistance;
    vec4 color = g_spheres[sphereIndex].m_color * g_ambient * g_spheres[sphereIndex].m_Ka;
    
    //define the normal at the intersection point
    vec4 normal = (intersectionPoint - g_spheres[sphereIndex].m_pos);
    normal = transpose(g_spheres[sphereIndex].m_inverse) * g_spheres[sphereIndex].m_inverse * normal;
    normal.w = 0;
    normal = normalize(normal);
    
    
    //now loop through all light in g_light for shadow rays and add diffuse and specular colors
    for(int i = 0; i < l_count; i++)
    {
        //define a new light ray to that pixel
        Ray lightRay;
        lightRay.origin = intersectionPoint;
        lightRay.dir = normalize(g_light[i].m_pos - intersectionPoint);
        float closestLightDist = INT_MAX; //closest distance to any sphere
        
        //look to see if light is obstructed
        for(int x =0; x < s_count; x++)
        {
            float a = intersection(g_spheres[x], lightRay, 1);
            if(a < closestLightDist && a >= 0.0001f)
            {
                closestLightDist = a;
            }
        }
        if(closestLightDist != INT_MAX)
            continue;   //if light is obstructed, don't add specular or diffuse color
        
        if(dot(normal, lightRay.dir) > 0) //make syre there is diffuse color
        {
            //diffuse color
            color += g_light[i].m_intensity * g_spheres[sphereIndex].m_Kd * dot(normal, lightRay.dir)
                * g_spheres[sphereIndex].m_color;
        
            
            //specular color
            vec4 r = 2 * normal * dot(normal, lightRay.dir) - lightRay.dir;
            vec4 v = ray.origin - intersectionPoint;
            color += powf(dot(normalize(r), normalize(v)), g_spheres[sphereIndex].m_spec_ex)
                *g_light[i].m_intensity * g_spheres[sphereIndex].m_Ks;
            
        }
    }
    
    //reflected light, rerun trace for the reflected ray. only run 3 times
    if(r_num < 3)
    {
        Ray rRay;
        rRay.origin = intersectionPoint;
        rRay.dir = normalize(ray.dir - 2.0f * normal * dot(normal, ray.dir));
        r_num++;
        color += trace(rRay, r_num) * g_spheres[sphereIndex].m_Kr;
    }
    
    return color;
}

vec4 getDir(int ix, int iy)
{
    float x = g_left + ((float) ix / g_width) * (g_right - g_left);
    float y = g_bottom + ((float) iy / g_height) * (g_top - g_bottom);
    float z = -g_near;
    return normalize(vec4(x, y, z, 0.0f));
}

void renderPixel(int ix, int iy)
{
    Ray ray;
    ray.origin = vec4(0.0f, 0.0f, 0.0f, 1.0f);
    ray.dir = getDir(ix, iy);
    vec4 color = trace(ray, 0);
    setColor(ix, iy, color);
}

void render()
{
    for (int iy = 0; iy < g_height; iy++)
        for (int ix = 0; ix < g_width; ix++)
            renderPixel(ix, iy);
}


// -------------------------------------------------------------------
// PPM saving

void savePPM(int Width, int Height, char* fname, unsigned char* pixels)
{
    FILE *fp;
    const int maxVal=255;
    
    printf("Saving image %s: %d x %d\n", fname, Width, Height);
    fp = fopen(fname,"wb");
    if (!fp) {
        printf("Unable to open file '%s'\n", fname);
        return;
    }
    fprintf(fp, "P6\n");
    fprintf(fp, "%d %d\n", Width, Height);
    fprintf(fp, "%d\n", maxVal);
    
    for(int j = 0; j < Height; j++) {
        fwrite(&pixels[j*Width*3], 3, Width, fp);
    }
    
    fclose(fp);
}

void saveFile()
{
    // Convert color components from floats to unsigned chars.
    unsigned char* buf = new unsigned char[g_width * g_height * 3];
    for (int y = 0; y < g_height; y++)
        for (int x = 0; x < g_width; x++)
            for (int i = 0; i < 3; i++)
            {
                //clamp
                float color = ((float*)g_colors[y*g_width+x])[i];
                color = fminf(color, 1);
                buf[y*g_width*3+x*3+i] = (unsigned char)(color * 255.9f);
            }
    savePPM(g_width, g_height, g_fileName, buf);
    delete[] buf;
}


// -------------------------------------------------------------------
// Main

int main(int argc, char* argv[])
{
    if (argc < 2)
    {
        cout << "Usage: template-rt <input_file.txt>" << endl;
        exit(1);
    }
    loadFile(argv[1]);
    render();
    saveFile();
    return 0;
}
