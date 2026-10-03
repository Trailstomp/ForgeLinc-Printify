if(!customElements.get("lincforge-team-shop"))customElements.define("lincforge-team-shop",class extends HTMLElement{
 connectedCallback(){
 if(this.initialized)return;this.initialized=true;this.team=this.querySelector("[data-team]");if(!this.team)return;
 this.variant=this.querySelector("[data-variant]");this.add=this.querySelector("[data-add]");this.status=this.querySelector("[data-status]");this.busy=false;
 this.theme=this.querySelector("select[data-theme]");this.logo=this.querySelector("select[data-logo]");
 try{this.products=Array.from(this.team.options).map(o=>({team:o.dataset.teamName||o.textContent.trim(),theme:o.dataset.theme||"Light",logo:o.dataset.logo||"Team crest",product:JSON.parse(o.dataset.product)}));}catch{this.status.textContent="Team products could not be loaded.";return;}
 this.fill(this.team,this.products.map(p=>p.team));
 this.team.addEventListener("change",()=>this.showThemes());this.theme.addEventListener("change",()=>this.showLogos());this.logo.addEventListener("change",()=>this.showProduct());this.variant.addEventListener("change",()=>this.updateVariant());this.add.addEventListener("click",()=>this.addToCart());this.showThemes();
 }
 fill(select,values){const previous=select.value;select.replaceChildren();[...new Set(values)].forEach(value=>{const o=document.createElement("option");o.value=value;o.textContent=value;select.append(o);});if(values.includes(previous))select.value=previous;}
 showThemes(){this.fill(this.theme,this.products.filter(p=>p.team===this.team.value).map(p=>p.theme));this.showLogos();}
 showLogos(){this.fill(this.logo,this.products.filter(p=>p.team===this.team.value&&p.theme===this.theme.value).map(p=>p.logo));this.showProduct();}
 root(){return window.Shopify?.routes?.root||"/";}
 showProduct(){
 try{
 this.product=this.products.find(p=>p.team===this.team.value&&p.theme===this.theme.value&&p.logo===this.logo.value)?.product;
 if(!this.product)throw new Error("No mapped product");
 this.status.textContent="";this.querySelector("[data-title]").textContent=this.product.title;
 const link=this.querySelector("[data-link]");link.href=this.root()+"products/"+encodeURIComponent(this.product.handle);
 this.variant.replaceChildren();
 this.product.variants.forEach(v=>{const o=document.createElement("option");o.value=String(v.id);o.textContent=v.title+(v.available?"":" — sold out");o.disabled=!v.available;this.variant.append(o);});
 const available=this.product.variants.find(v=>v.available);if(available)this.variant.value=String(available.id);
 const image=this.querySelector("[data-image]");const thumbs=this.querySelector("[data-images]");thumbs.replaceChildren();
 const images=this.product.images||[];image.hidden=!images.length;
 const show=(src)=>{image.src=src;image.alt=this.product.title;};if(images.length)show(images[0]);
 images.forEach((src,i)=>{const b=document.createElement("button");b.type="button";b.setAttribute("aria-label","Show product image "+(i+1));const thumb=document.createElement("img");thumb.src=src;thumb.alt="";b.append(thumb);b.onclick=()=>show(src);thumbs.append(b);});
 this.updateVariant();
 }catch{this.add.disabled=true;this.status.textContent="This team product could not be loaded.";}
 }
 updateVariant(){
 const v=this.product?.variants.find(v=>String(v.id)===this.variant.value);
 this.add.disabled=this.busy||!v?.available;this.add.textContent=v?.available?"Add to cart":"Sold out";
 this.querySelector("[data-price]").textContent=v?new Intl.NumberFormat(document.documentElement.lang||"en",{style:"currency",currency:this.dataset.currency||"USD"}).format(v.price/100):"";
 }
 async addToCart(){
 if(this.busy)return;const v=this.product?.variants.find(v=>String(v.id)===this.variant.value);if(!v?.available)return;
 this.busy=true;this.team.disabled=true;this.theme.disabled=true;this.logo.disabled=true;this.variant.disabled=true;this.updateVariant();this.status.textContent="Adding to cart…";
 try{
 const r=await fetch(this.root()+"cart/add.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{id:v.id,quantity:1,properties:{"Team":this.team.value,"Jersey theme":this.theme.value,"Front logo":this.logo.value}}]})});
 const body=await r.json();if(!r.ok)throw new Error(body.description||"Could not add this item.");
 window.location.assign(this.root()+"cart");
 }catch(e){this.status.textContent=e.message||"Please try again.";this.busy=false;this.team.disabled=false;this.theme.disabled=false;this.logo.disabled=false;this.variant.disabled=false;this.updateVariant();}
 }
});

