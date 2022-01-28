//cool shader created by Andy to display all normal vectors of a figure as colors
//uses vertex and fragment programs
Shader "Unlit/Normals" {
    
    //any exposed variables we use are referenced from here
    Properties {
        //we dont have any lol
    }

    //first priority shader
    SubShader {
        Tags {"RenderType" = "Opaque"}
        LOD 100
        Cull Off
        ZWrite On
        //Blend SrcAlpha OneMinusSrcAlpha

        //first pass if this shader is chosen
        Pass {

            //begin Cg/HLSL language
            CGPROGRAM

            //defines the vertex and fragment program and includes Unity's API
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            //this type only stores necessary data for the position and color
            struct v2f {
                float4 pos : SV_POSITION;
                fixed3 color : COLOR0;
            };

            //vertex program that takes in values and returns a v2f with calculated color from normal vector
            v2f vert(appdata_base v)
            {
                v2f o;

                //activate wobble
                //v.vertex.x += sin(_Time.y * 5 + v.vertex.x * 50) * .5;
                //v.vertex.y += sin(sin(_Time.y * 1.5 + v.vertex.x * 1.5 + v.vertex.z * 1.5) * 4) * 6;
                //v.normal.z += sin(_Time.x * 1.5 + v.vertex.x * .5 + v.vertex.z * .5) * 9;
                //v.normal.x += sin(_Time.z * 1.5 + v.vertex.x * .5 + v.vertex.z * .5) * 9;

                o.pos = UnityObjectToClipPos(v.vertex);

                //normal relative to local
                //o.color = v.normal * 0.5 + 0.5;

                //normal relative to the world!
                o.color = UnityObjectToWorldNormal(v.normal) * 0.5 + 0.5;

                return o;
            }


            //applies the normal color and an alpha value of "1"
            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 col = fixed4(i.color, 1);
                
                //make glow by however much
                //col *= 2;
                
                //slice off the sides
                //clip(col.r - .1);
                //clip(.9 - col.r);

                return col;
            }
            ENDCG

        }

        //more passes if we need more
    }

    //next priority subshaders if we need more

    FallBack "VertexLit" //fallback if all else fails
}