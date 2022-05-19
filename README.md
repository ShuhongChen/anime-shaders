
# Anime Shaders

![lucy][lucy]

[lucy]: _env/__lucy__.png 'Suggestive Contours of the Stanford Lucy'

**Non-Photorealistic Shading Techniques for Anime-Style Rendering**  
Andy Qu[\*](https://toastymcvoid.itch.io/), Shuhong Chen[\*](https://shuhongchen.github.io/), Matthias Zwicker[\*](https://www.cs.umd.edu/~zwicker/)  
University of Maryland, College Park  
Department of Computer Science  
\[[github](https://github.com/ShuhongChen/anime-shaders)\]
\[[paper](https://github.com/ShuhongChen/anime-shaders/blob/main/Final_Report.pdf)\]

_Shaders have historically played a crucial part in drawing 3D models onto a computer screen as they have been an important component in computer games, movies, and simulations. As a result, various well-known shading methods and techniques have been used to suit a multitude of purposes and environments, including Flat, Gouraud, and Phong shading. Of the many shading methods, some can be used to mimic photorealism while others have been utilized to achieve different results, including a cartoon-ish depiction. In our work, we create GLSL and Python implementations of some of the classically known shading techniques as well as other non-photorealistic shaders that aim to mimic the Anime-like style._

## Setting Up

### Prerequisites

- latest edition of Mozilla Firefox
- an installation of Python
- an installation of a package manager for Python (either `Anaconda` or `pip`)
- a Python environment with `PIL`/`pillow` and `numpy` installed
- the `security.fileuri.strict_origin_policy` set to `false` when accessing `about:config` on Firefox
- a clone of this repo on your computer

### Instructions

Each of the top-level directories prepended with the prefix `ThreeJS` contains a runnable Three.js world. To run them, simply run the `index.html` file on Firefox. Some of the worlds can give you the option to change the 3D mesh being drawn or the shader being used. If you would like to change either the mesh or the shader, look into the `main.js` file in that world's respective directory and simply change the values of the `shapeOption` or `shaderOption` variables, respectively.

A few of the top-level directories are named with the prefix `ThreeJS-Python`. These are also Three.js worlds that include Python implementations that help with drawing suggestive contours of models. To run them, please use the following command from within the dicrectory:

    python sugg_contours.py

If you are running this command for the `ThreeJS-Python_Altogether` world, please ensure that the `final.png`, `sugg_contours.png`, `base.png`, `viewers.png`, `normals.png`, and `ws.png` files are present within the directory as they are needed for the script to run.

Similiarly, when running this command for the `ThreeJS-Python_Multipass_Suggestive_Shading` world, make sure that the `sugg_contours.png`, `contours.png`, `viewers.png`, `normals.png`, and `ws.png` files are present within the directory.

## Technologies Used

* [ThreeJS](https://threejs.org/) - OpenGL library for JavaScript
* [GLSL](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language) - Shader language
* [Python](https://www.python.org/) - Programming language (for some implementations)
* [VScode](https://code.visualstudio.com/) - Code editor
* [Mozilla Firefox](https://www.mozilla.org/en-US/firefox/new/) - Main web browser

## Artist Acknoledgements

* [ajax.stl](https://cults3d.com/en/3d-model/art/bust-of-ajax) - Ajax Bust
* [amber.stl](https://hub.vroid.com/en/characters/3742574954744824945/models/3661281045858685259) - Amber of Genshin Impact
* [lucy.stl](https://www.thingiverse.com/thing:41939) - Stanford Lucy
* [usada\_pekora.stl](https://3d.nicovideo.jp/works/td67414) - Usada Pekora
* [Utah\_teapot.stl](https://cults3d.com/en/3d-model/art/utah-teapot-solid) - Utah Teapot