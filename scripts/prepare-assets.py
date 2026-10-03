from pathlib import Path
import shutil,json
root=Path('/workspace/scratch/7d11dcaa9fd5')
dest=Path('public/assets');dest.mkdir(parents=True,exist_ok=True)
rows=[
('dayton-eagles','Dayton Eagles','Dayton Eagles lacrosse emblem.png','Dayton_Eagles','#092c49','#cc1428'),
('dayton-bombers','Dayton Bombers','Dayton Bombers.png','Dayton_Bombers','#181c25','#c8192f'),
('trash-pandas','Trash Pandas','Trash Pandas.png','Trash_Pandas','#202029','#ed2385'),
('oh10','OH10','OH10.png','OH10','#141414','#d41c28'),
('ballhogs','BallHogs','BallHogs.png','BallHogs','#063259','#3bace2'),
('bulldawgs','Bulldawgs','Bulldawgs.png','Bulldawgs','#241e18','#d9a330'),
('american-dads','American Dads','American Dads.png','American_Dads','#14263c','#c72132'),
('indy-lacers','Indy Lacers','Indy Lacers.png','Indy_Lacers','#0a2441','#dca631'),
('indiana-sabers','Indiana Sabers','Indiana Sabers.png','Indiana_Sabers','#0c2944','#d7aa34'),
('black-snakes','Black Snakes','Fort Wayne Black Snakes.png','Black_Snakes','#1b2320','#98c53d'),
('queen-city','Queen City Steamboats','ChatGPT Image Jul 14, 2026, 10_45_18 PM.png','Queen_City_Steamboats','#153c80','#e44327')]
teams=[]
for id,name,logo,back,primary,accent in rows:
    shutil.copyfile(root/'work/logos2_original'/logo,dest/(id+'-logo.png'))
    shutil.copyfile(root/'output/MLBL_Team_Back_Artwork'/(back+'_Back.png'),dest/(id+'-back.png'))
    teams.append(dict(id=id,name=name,logo='/assets/'+id+'-logo.png',back='/assets/'+id+'-back.png',primary=primary,accent=accent,mirror=id=='indiana-sabers'))
shutil.copyfile(root/'generated_images/exec-3028d789-1717-4d64-90d5-2bd46faa61be.png',dest/'jersey-front.png')
shutil.copyfile(root/'generated_images/exec-0c0d666c-effe-4308-b170-fd4f9a5a0542.png',dest/'jersey-back.png')
shutil.copyfile(root/'work/logos2_original/ChatGPT Image Jul 11, 2026, 07_05_54 AM.png',dest/'mlbl.png')
shutil.copyfile(root/'work/qr_assets/MLBL QR1nb.png',dest/'qr.png')
for name in ['Front','Back','Left Sleeve','Right Sleeve','Collar']:
    shutil.copyfile(root/'work/recovered_template/extracted/PNG'/(name+'.png'),dest/('guide-'+name.lower().replace(' ','-')+'.png'))
Path('lib/teams.json').write_text(json.dumps(teams,indent=2)+'\n')
print('Prepared',len(teams),'teams and original templates')
