import json,glob,re,html,sys
def plain(h):
    h=re.sub(r'</p>\s*<p>','\n\n',h or ''); h=re.sub(r'<br\s*/?>','\n',h); h=re.sub(r'<[^>]+>','',h)
    return html.unescape(h).strip()
out=[]
for pack in ['bestiary','humanlike']:
  for f in sorted(glob.glob(f'src/packs/{pack}/*.json')):
    d=json.load(open(f))
    if d.get('type')!='npc': continue
    s=d['system'];a=s['attributes'];de=s['details']
    acts=[]
    for i in sorted([i for i in d.get('items',[]) if i['type']=='action'],key=lambda i:i['system'].get('sort',0)):
        x=i['system']
        t=plain(x.get('description'))
        dmg=x.get('damage') or ''
        avg=x.get('average')
        # strip leading "avg (dmg)" from text
        if dmg:
            t=re.sub(r'^\d+\s*\('+re.escape(dmg)+r'\)\s*','',t)
        r={'n':i['name'],'t':x.get('actionType','action'),'g':x.get('tags',''),'d':dmg,'s':x.get('save',''),'r':x.get('recharge',''),'x':t}
        acts.append({k:v for k,v in r.items() if v not in ('',None)})
    c={'name':d['name'],'pack':pack,'hd':s.get('hd'),'hp':a['hp']['max'],'armor':a.get('armor',0),'armorTag':a.get('armorTag',''),'morale':a.get('morale'),
       'speed':a['speed']['value'],'speedTypes':a['speed'].get('types',''),'size':de.get('size'),'beingType':de.get('beingType'),'subtype':de.get('subtype',''),
       'zone':de.get('zone'),'appearing':de.get('appearing',''),'senses':de.get('senses',''),'immune':de.get('immune',''),'weak':de.get('weak',''),
       'statusImmunities':de.get('statusImmunities',''),'desc':plain(de.get('description')),'tl':s.get('tl'),'actions':acts}
    out.append({k:v for k,v in c.items() if v not in ('',None)})
json.dump(out,sys.stdout,separators=(',',':'),ensure_ascii=False)
