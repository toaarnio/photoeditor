/*
 * This file is part of the Nokia WebCL project.
 *
 * This Source Code Form is subject to the terms of the
 * Mozilla Public License, v. 2.0. If a copy of the MPL
 * was not distributed with this file, You can obtain
 * one at http://mozilla.org/MPL/2.0/.
 *
 * The Original Contributor of this Source Code Form is
 * Nokia Research Tampere (http://webcl.nokiaresearch.com).
 */

/**
 * Sobel filter implementation in OpenCL C. Uses a 3x3-pixel kernel.
 *
 * @param {uchar4*} src
 * @param {uchar4*} dst
 * @param {uint} width
 * @param {uint} height
 * @param {float} threshold
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

#define USE_TEXTURING
#ifdef USE_TEXTURING

kernel void clSobel(read_only image2d_t src, __global uchar4* dst,
                    const uint width, const uint height, const float threshold)
{
  int x = get_global_id(0);
  int y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;

  const sampler_t sampler = 
    CLK_NORMALIZED_COORDS_FALSE |
    CLK_ADDRESS_MIRRORED_REPEAT |
    CLK_FILTER_NEAREST;

  float4 samples[9];
  for (int i = 0, yy = y-1, xx = x-1; i < 9; i += 3, yy++) {
    samples[i  ] = read_imagef(src, sampler, (int2)(xx  , yy));
    samples[i+1] = read_imagef(src, sampler, (int2)(xx+1, yy));
    samples[i+2] = read_imagef(src, sampler, (int2)(xx+2, yy));
  }

  //    -1 -2 -1        1 0 -1
  // H = 0  0  0    V = 2 0 -2
  //     1  2  1        1 0 -1

  float4 vertEdge = 
    samples[2]*0.25f + samples[5]*0.5f + samples[8]*0.25f -
    (samples[0]*0.25f + samples[3]*0.5f + samples[6]*0.25f);

  float4 horizEdge = 
    samples[0]*0.25f + samples[1]*0.5f + samples[2]*0.25f -
    (samples[6]*0.25f + samples[7]*0.5f + samples[8]*0.25f);
  
  float4 edgeColor = sqrt(horizEdge * horizEdge + vertEdge * vertEdge);

  float lum = 0.30f * edgeColor.x + 0.55f * edgeColor.y + 0.15f * edgeColor.z;

  uint center = y * width + x;
  dst[center] = clamp(lum, 0.0f, 1.0f) > threshold ? 255 : 0;
}

#else

kernel void clSobel(__global const uchar4* src, __global uchar4* dst,
                      const uint width, const uint height, const float threshold)
{
  int x = get_global_id(0);
  int y = get_global_id(1);
  if (x >= width) return;
  if (y >= height) return;
  //if ((x < 1) || (x >= width-1)) return;
  //if ((y < 1) || (y >= height-1)) return;

  float4 samples[9];
  for (uint i = 0, yy = max(0, y-1), xx = max(0, x-1); i < 9; i += 3) {
    uint rowStart = yy * width + xx;
    rowStart = clamp(rowStart, 0u, width*height-3);
    samples[i  ] = convert_float4(src[rowStart  ]);
    samples[i+1] = convert_float4(src[rowStart+1]);
    samples[i+2] = convert_float4(src[rowStart+2]);
    yy++;
    if (yy == height) break;
  }

  //    -1 -2 -1        1 0 -1
  // H = 0  0  0    V = 2 0 -2
  //     1  2  1        1 0 -1

  float4 vertEdge = 
    samples[2]*0.25f + samples[5]*0.5f + samples[8]*0.25f -
    (samples[0]*0.25f + samples[3]*0.5f + samples[6]*0.25f);

  float4 horizEdge = 
    samples[0]*0.25f + samples[1]*0.5f + samples[2]*0.25f -
    (samples[6]*0.25f + samples[7]*0.5f + samples[8]*0.25f);
  
  // max(edgeColor.[xyz]) = sqrt(255^2 + 255^2) = sqrt(2)*255

  float4 edgeColor = sqrt(horizEdge * horizEdge + vertEdge * vertEdge);

  float lum = 0.30f * edgeColor.x + 0.55f * edgeColor.y + 0.15f * edgeColor.z;

  uint center = y * width + x;
  dst[center] = clamp(lum, 0.0f, 255.0f) > (threshold*255.0f) ? 255 : 0;
}

#endif
