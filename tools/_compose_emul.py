# Emulate the kit's fit2 + composed() exactly, with PIL in place of sharp.
from PIL import Image
import sys, os
GAP=4; LARGE_COVER_BOX={'width':1024,'height':640}; REST_BOX={'width':1024,'height':640}

def fit(path, box):
    im=Image.open(path).convert('RGB')
    s=min(box['width']/im.width, box['height']/im.height, 1.0)
    w,h=max(1,round(im.width*s)), max(1,round(im.height*s))
    return im.resize((w,h), Image.LANCZOS)

def rest_cell(n):
    columns=-(-int(n**0.5)//1)
    import math; columns=math.ceil(math.sqrt(n)); rows=math.ceil(n/columns)
    return {'columns':columns,'rows':rows,'width':(REST_BOX['width']-(columns-1)*GAP)//columns,
            'height':(REST_BOX['height']-(rows-1)*GAP)//rows}

def composed(rows):
    roww=lambda r: sum(f.width for f in r)+(len(r)-1)*GAP
    width=max(roww(r) for r in rows); placed=[]; height=-GAP
    for row in rows:
        rh=max(f.height for f in row); left=(width-roww(row))//2; top=height+GAP
        for f in row:
            placed.append((f,left,top+(rh-f.height)//2)); left+=f.width+GAP
        height=top+rh
    canvas=Image.new('RGB',(width,height),(0,0,0))
    for f,l,t in placed: canvas.paste(f,(l,t))
    return canvas,(width,height)

def run(dirpath,outprefix,cover=0):
    names=sorted([n for n in os.listdir(dirpath) if n.endswith('.png')])
    imgs=[fit(os.path.join(dirpath,n),LARGE_COVER_BOX) for n in names]
    coverim=imgs[cover]
    c,sz=composed([[coverim]]); c.save(outprefix+'-cover.png')
    print(outprefix,'cover',sz)
    rest=[im for i,im in enumerate(imgs) if i!=cover]
    if rest:
        cell=rest_cell(len(rest)); print('  restCell',cell)
        fitted=[fit(os.path.join(dirpath,names[i]),cell) for i in range(len(names)) if i!=cover]
        rows=[fitted[i*cell['columns']:(i+1)*cell['columns']] for i in range(len(fitted)//cell['columns']+ (1 if len(fitted)%cell['columns'] else 0))]
        c,sz=composed(rows); c.save(outprefix+'-sheet.png')
        print('  sheet',sz,[f.size for r in rows for f in r])

run(sys.argv[1],sys.argv[2])
