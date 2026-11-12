import json,unittest
from pathlib import Path
class ModelTest(unittest.TestCase):
 def test_official_model_is_complete_and_has_all_six_color_groups(self):
  p=Path('dist/assets/duck.json')
  self.assertTrue(p.exists(),'Official geometry assembly has not been generated')
  m=json.loads(p.read_text())
  self.assertTrue(m['source'].startswith('https://github.com/pollen-robotics/microduck_rl'))
  self.assertEqual(set(x['group'] for x in m['instances'])-{'fixed'}, {'body','guards','eyes','hips','feet','soles'})
  self.assertGreater(len(m['instances']),40)
  self.assertTrue(Path('dist/assets/duck.bin.gz').stat().st_size>100000)
if __name__=='__main__':unittest.main()
