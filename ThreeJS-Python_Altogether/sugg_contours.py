

# from anime-shaders/ folder, run:
# python3 -m python_pass_example.contours

# import libraries
from PIL import Image
import numpy as np

# load image
base_img = Image.open('./base.png').convert('RGB')
base_arr = np.asarray(base_img)/255.0
normals_img = Image.open('./normals.png').convert('RGB')
normals_arr = ((np.asarray(normals_img)/255.0) - 0.5) * 2
viewers_img = Image.open('./viewers.png').convert('RGB')
viewers_arr = ((np.asarray(viewers_img)/255.0) - 0.5) * 2
ws_img = Image.open('./ws.png').convert('RGB')
ws_arr = ((np.asarray(ws_img)/255.0) - 0.5) * 2

# process pixel-by-pixel
threshold = 0.1
h,w,ch = normals_arr.shape
out_arr = np.zeros((h,w))
final_arr = np.zeros((h,w,ch))
for i in range(1, h-1):
	for j in range(1, w-1):

		# calculate forward finite difference for first derivative
		dx = np.dot(normals_arr[i,j+1], viewers_arr[i,j+1]) - np.dot(normals_arr[i,j], viewers_arr[i,j])
		dy = np.dot(normals_arr[i-1,j], viewers_arr[i-1,j]) - np.dot(normals_arr[i,j], viewers_arr[i,j])

		# calculate forward finite difference for first derivative of the neighboring pixel in the -x direction
		xneighbordx = np.dot(normals_arr[i,j], viewers_arr[i,j]) - np.dot(normals_arr[i,j-1], viewers_arr[i,j-1])
		xneighbordy = np.dot(normals_arr[i-1,j-1], viewers_arr[i-1,j-1]) - np.dot(normals_arr[i,j-1], viewers_arr[i,j-1])

		# calculate forward finite difference for first derivative of the neighboring pixel in the -y direction
		yneighbordx = np.dot(normals_arr[i+1,j+1], viewers_arr[i+1,j+1]) - np.dot(normals_arr[i+1,j], viewers_arr[i+1,j])
		yneighbordy = np.dot(normals_arr[i,j], viewers_arr[i,j]) - np.dot(normals_arr[i+1,j], viewers_arr[i+1,j])
		
		# calculate directional derivatives for this pixel and its neighbors in the -x and -y directions
		dwdot = dx * ws_arr[i,j,0] + dy * ws_arr[i,j,1]
		xneighbordwdot = xneighbordx * ws_arr[i,j-1,0] + xneighbordy * ws_arr[i,j-1,1]
		yneighbordwdot = yneighbordx * ws_arr[i+1,j,0] + yneighbordy * ws_arr[i+1,j,1]

		# calculate second order directional derivative using backward finite differences of first derivatives
		dwdwdot = (dwdot - xneighbordwdot) * ws_arr[i,j,0] + (dwdot - yneighbordwdot) * ws_arr[i,j,1]

		if dwdot <= threshold and dwdot >= -threshold and dwdwdot > 0.025:
			out_arr[i,j] = 1
			final_arr[i,j] = [0.3, 0.3, 0.3]
		else:
			out_arr[i,j] = 0
			final_arr[i,j] = base_arr[i,j]

# save image
out_img = Image.fromarray((out_arr*255).astype(np.uint8))
out_img.save('./sugg_contours.png')
final_img = Image.fromarray((final_arr*255).astype(np.uint8))
final_img.save('./final.png')


