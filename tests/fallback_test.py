import unittest
from pathlib import Path
from PIL import Image
class FallbackTest(unittest.TestCase):
 def test_real_geometry_has_twenty_four_gpu_free_views(self):
  frames=list(Path('dist/assets/views').glob('frame-*.png'))
  self.assertEqual(len(frames),24,'GPU-free real model views are missing')
  for frame in frames:
   with Image.open(frame) as im:self.assertEqual(im.size,(840,840))
 def test_hero_contains_independent_face_head_and_left_right_feet_masks(self):
  import numpy as np
  p=Path('dist/assets/views/frame-03.png')
  self.assertTrue(p.exists(),'Real geometry mask is missing')
  a=np.array(Image.open(p));self.assertTrue({39,43,48,25,70}.issubset(set(a[:,:,1][a[:,:,3]>0].flatten())))
if __name__=='__main__':unittest.main()
