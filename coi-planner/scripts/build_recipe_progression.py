#!/usr/bin/env python3
"""Build deterministic, auditable recipe progression metadata.

Research tier and machine/variant tier are deliberately separate. The reference
snapshot is used for unlock provenance; normalized Harbor tiers split the game's
large raw tier-0 era into T0 (starter) and T1 (advanced pre-Lab-II progression).
"""
from __future__ import annotations
import json, re
from collections import defaultdict, Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'src'/'data'
REF=ROOT/'scripts'/'reference-update3.json'

def load(p): return json.loads(Path(p).read_text())
def norm(s):
    s=(s or '').lower().replace(' ii',' 2').replace(' iii',' 3').replace(' iv',' 4').replace(' v',' 5')
    return re.sub(r'[^a-z0-9]','',s)
def machine_tier(name):
    m=re.search(r'(?:\s|\b)(V|IV|III|II|I|[1-5])$',name or '',re.I)
    if not m:return None
    return {'I':1,'II':2,'III':3,'IV':4,'V':5}.get(m.group(1).upper(),int(m.group(1)) if m.group(1).isdigit() else None)
def variant_tier(name,rid):
    m=re.search(r'\(T([1-5])(?:[-)]|\b)',name or '',re.I) or re.search(r'(?:^|_)t([1-5])(?:_|$)',rid,re.I)
    return int(m.group(1)) if m else None

def main():
    recipes=load(DATA/'recipes.json'); machines=load(DATA/'machines.json'); products=load(DATA/'products.json'); ref=load(REF)
    research={x['id']:x for x in ref['research']}; depth_cache={}
    def depth(rid,path=frozenset()):
        if rid in depth_cache:return depth_cache[rid]
        if rid in path or rid not in research:return 0
        parents=research[rid].get('parentIds') or []
        value=0 if not parents else 1+max(depth(x,path|{rid}) for x in parents)
        depth_cache[rid]=value;return value
    def normalized(raw,rid=None):
        if raw is None:return None
        if raw==0:return 0 if depth(rid or '')<=3 else 1
        return max(0,min(5,int(raw)))
    direct={}; entity_unlock={}; product_unlock=defaultdict(list)
    for r in ref['research']:
        info={'raw':r.get('tier',0),'tier':normalized(r.get('tier',0),r['id']),'id':r['id'],'name':r.get('name',r['id']),'depth':depth(r['id'])}
        for u in r.get('unlocks') or []:
            if u['type']=='recipe': direct[u['id']]=info
            elif u['type'] in ('machine','building','other'): entity_unlock[u['id']]=info
            elif u['type']=='product': product_unlock[u['id']].append(info)
    ref_products={x['id']:x.get('name',x['id']) for x in ref['products']}
    ref_product_by_name={norm(v):k for k,v in ref_products.items()}
    recipe_machines=defaultdict(list)
    for m in ref['machines']:
        for rid in m.get('recipes') or []:recipe_machines[rid].append(m['id'])
    ref_by_machine_name=defaultdict(list);ref_by_machine=defaultdict(list)
    for r in ref['recipes']:
        for mid in recipe_machines[r['id']]:
            ref_by_machine_name[(mid,norm(r.get('name') or r['id']))].append(r);ref_by_machine[mid].append(r)
    def sig_source(r,side):
        dur=r.get('durationSeconds') or 60
        return sorted((norm(ref_products.get(x['productId'],x['productId'])),round(float(x['quantity'])*60/dur,5)) for x in r.get(side,[]) if not x.get('hideInUi'))
    def sig_ours(r,side):return sorted((norm(x.get('name') or products.get(x['id'],{}).get('name',x['id'])),round(float(x['quantity']),5)) for x in r.get(side,[]))
    def same_sig(a,b):
        if len(a)!=len(b):return False
        return all(x[0]==y[0] and abs(x[1]-y[1])<.03 for x,y in zip(a,b))
    active=set()
    blocked={'storage','storages','cargo_docks'}
    for p in products.values():
        for rid in p.get('recipes',{}).get('output',[]):
            r=recipes.get(rid);m=machines.get(r.get('machine')) if r else None
            if r and m and not m.get('isStorage') and m.get('category_id') not in blocked and any(o['id']==p['id'] for o in r['outputs']):active.add(rid)
    out={};audit=[]
    for rid,r in recipes.items():
        m=machines.get(r['machine'],{});game_mid=m.get('game_id'); candidates=list(ref_by_machine_name.get((game_mid,norm(r['name'])),[]))
        matched=None;match_method=None
        if len(candidates)==1: matched=candidates[0];match_method='MACHINE_AND_NAME'
        elif candidates:
            exact=[x for x in candidates if same_sig(sig_source(x,'inputs'),sig_ours(r,'inputs')) and same_sig(sig_source(x,'outputs'),sig_ours(r,'outputs'))]
            if len(exact)==1:matched=exact[0];match_method='MACHINE_NAME_SIGNATURE'
        if not matched and game_mid:
            exact=[x for x in ref_by_machine.get(game_mid,[]) if same_sig(sig_source(x,'inputs'),sig_ours(r,'inputs')) and same_sig(sig_source(x,'outputs'),sig_ours(r,'outputs'))]
            if len(exact)==1:matched=exact[0];match_method='MACHINE_SIGNATURE'
        info=None;provenance='UNRESOLVED';confidence='low';game_id=None
        if matched:
            game_id=matched['id'];info=direct.get(game_id)
            if info:provenance='DIRECT_RECIPE_UNLOCK';confidence='high'
            else:
                mis=[entity_unlock.get(x) for x in recipe_machines.get(game_id,[]) if entity_unlock.get(x)]
                if mis:info=min(mis,key=lambda x:x['tier']);provenance='MACHINE_UNLOCK';confidence='high'
                else:info={'raw':0,'tier':0,'id':None,'name':'Available at start','depth':0};provenance='AVAILABLE_AT_START';confidence='medium'
        if not info and game_mid and game_mid in entity_unlock:
            info=entity_unlock[game_mid];provenance='MACHINE_UNLOCK';confidence='medium'
        # Farm operations are generated outside the ordinary recipe list. Their tier is
        # the later of the farm building and crop unlock. Product entries in research
        # are display dependencies, not general recipe unlocks, and must not be used.
        if m.get('isFarm'):
            crop_infos=[]
            for o in r.get('outputs',[]):
                crop_key='Crop_'+re.sub(r'[^A-Za-z0-9]','',o.get('name') or products.get(o['id'],{}).get('name',''))
                if crop_key in entity_unlock:crop_infos.append(entity_unlock[crop_key])
            if crop_infos:
                latest=max(([info] if info else [])+crop_infos,key=lambda x:x['tier'])
                if not info or latest['tier']>info['tier']:info=latest;provenance='CROP_AND_FARM_UNLOCK';confidence='high'
        pseudo=bool(m.get('isMine') or m.get('isFarm') or r['name'].lower().endswith('mining') or 'powerlevel' in r['name'].lower() or 'research lab' in r['name'].lower())
        if not info:
            mt=machine_tier(m.get('name',''))
            # Deterministic final override: never turn an unknown advanced operation into T0.
            tier=max(0,min(5,mt or (1 if m.get('isFarm') else 0)))
            info={'raw':None,'tier':tier,'id':None,'name':'Curated machine fallback','depth':None}
            provenance='PSEUDO_RECIPE' if pseudo else 'MANUAL_OVERRIDE';confidence='low'
        rec={'researchTier':info['tier'],'rawResearchTier':info['raw'],'machineTier':machine_tier(m.get('name','')),'variantTier':variant_tier(r['name'],rid),'unlockResearchId':info['id'],'unlockResearchName':info['name'],'provenance':provenance,'confidence':confidence,'gameId':game_id,'isPseudoRecipe':pseudo}
        out[rid]=rec
        if rid in active:audit.append({'id':rid,'name':r['name'],'machine':m.get('name'),**rec})
    # Keep facility/storage/disposal metadata too: dynamic output-route availability
    # needs progression information for recipes that are not normal producers.
    runtime_out={rid:out[rid] for rid in sorted(out)}
    (DATA/'recipe-progression.json').write_text(json.dumps(runtime_out,indent=2,ensure_ascii=False)+'\n')
    hist=Counter(x['researchTier'] for x in audit);prov=Counter(x['provenance'] for x in audit);conf=Counter(x['confidence'] for x in audit)
    lines=['# Recipe progression audit','','Generated from explicit research unlocks where available. Research tier, machine tier, and variant tier are separate fields.','','## Coverage',f'- Filter-relevant recipes: **{len(audit)}**',f'- Distribution: **{dict(sorted(hist.items()))}**',f'- Provenance: **{dict(prov)}**',f'- Confidence: **{dict(conf)}**','','## Low-confidence records','','| ID | Recipe | Machine | Tier | Provenance |','|---|---|---|---:|---|']
    for x in audit:
        if x['confidence']=='low':lines.append(f"| `{x['id']}` | {x['name']} | {x['machine']} | T{x['researchTier']} | {x['provenance']} |")
    (ROOT/'REZEPTSTUFEN-AUDIT.md').write_text('\n'.join(lines)+'\n')
    print('active',len(audit),'tiers',dict(sorted(hist.items())),'provenance',dict(prov),'confidence',dict(conf))
if __name__=='__main__':main()
