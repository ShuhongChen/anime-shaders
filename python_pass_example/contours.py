

# from anime-shaders/ folder, run:
# python3 -m python_pass_example.contours

# import libraries
from PIL import Image
import numpy as np

# load image
normals_img = Image.open('./python_pass_example/normals.png').convert('RGB')
normals_arr = (np.asarray(normals_img)/255.0) * 2 - 0.5

# process pixel-by-pixel
threshold = 0.1
h,w,ch = normals_arr.shape
out_arr = np.zeros((h,w))
for i in range(h-1):
    for j in range(w-1):
        dx = np.linalg.norm(normals_arr[i,j] - normals_arr[i+1,j])
        dy = np.linalg.norm(normals_arr[i,j] - normals_arr[i,j+1])
        dxy = np.sqrt(dx**2 + dy**2)
        if dxy > threshold:
            out_arr[i,j] = 1
        else:
            out_arr[i,j] = 0

# save image
out_img = Image.fromarray((out_arr*255).astype(np.uint8))
out_img.save('./python_pass_example/contours.png')


