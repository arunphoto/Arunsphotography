<script>
(function(){
  const manifestUrl='media-manifest.json?ts='+Date.now();
  function mediaPath(url){try{return new URL(url,location.href).pathname.replace(/^\//,'');}catch{return url||'';}}
  function hideImage(el){const target=el.closest('.category-image,.card,.g,.fg,.portfolio-item,.gallery-item')||el.parentElement; if(target) target.style.display='none';}
  function hideVideo(el){const target=el.closest('.video-card,.card')||el.parentElement; if(target) target.style.display='none';}
  function apply(m){
    const hiddenI=new Set(m.hiddenImages||[]), hiddenV=new Set(m.hiddenVideos||[]), overrides=m.videoOverrides||{};
    document.querySelectorAll('img').forEach(img=>{
      const p=mediaPath(img.getAttribute('src')||'');
      if(hiddenI.has(p)) hideImage(img);
      img.addEventListener('error',()=>hideImage(img),{once:true});
    });
    document.querySelectorAll('video').forEach(v=>{
      let src=v.getAttribute('src');
      let source=v.querySelector('source');
      const p=mediaPath(src || source?.getAttribute('src') || '');
      if(hiddenV.has(p)) hideVideo(v);
      if(overrides[p]){v.src=overrides[p]+'?v='+encodeURIComponent(m.updatedAt||Date.now()); if(source) source.removeAttribute('src'); v.load();}
      v.addEventListener('error',()=>hideVideo(v),{once:true});
    });
  }
  fetch(manifestUrl,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(m=>m&&apply(m)).catch(()=>{});
})();
</script>
