function setupShopExtras(modal) {
  if(modal.querySelector('[data-shop-page="extras"]'))return;
  const skins=window.TeacherTilesPlannerSkins;
  const page=document.createElement('section');page.className='shop-page';page.dataset.shopPage='extras';page.hidden=true;
  page.innerHTML='<div class="shop-page-heading"><button class="shop-back" type="button" data-shop-open-page="home" aria-label="Back to shop home">←</button><div><span>EXTRAS</span><h2>Planner Skins</h2><p>A personal touch for your planning shelf. Choose a cover for each book.</p></div></div><div class="shop-product-grid shop-product-grid--extras"></div>';
  for(const skin of skins.catalog){
    const product=document.createElement('article');product.className='shop-product shop-product--planner-skin';product.dataset.shopProduct=skin.productId;product.dataset.shopPrice=skin.price;
    product.innerHTML='<div class="shop-product__preview shop-product__preview--planner" aria-hidden="true"></div><div class="shop-product__body"><div><span class="shop-product__type">PLANNER SKIN</span><h3></h3><p></p></div><button class="shop-buy" type="button" data-shop-buy><span class="shop-coin-icon shop-coin-icon--small" aria-hidden="true"><img src="assets/shop/coin.png" alt=""></span><strong>250</strong></button></div>';
    product.querySelector('h3').textContent=skin.name;product.querySelector('p').textContent=skin.description;product.querySelector('.shop-product__preview').append(skins.preview(skin.id));page.querySelector('.shop-product-grid').append(product);
  }
  modal.querySelector('.shop-content').append(page);
  const category=document.createElement('button');category.type='button';category.className='shop-category shop-category--extras';category.dataset.shopOpenPage='extras';
  category.innerHTML='<span class="shop-category__art shop-category__art--extras" aria-hidden="true"></span><span class="shop-category__copy"><strong>Extras</strong><em>Planner Skins & More</em></span>';
  for(const skin of skins.catalog.slice(0,2))category.querySelector('.shop-category__art').append(skins.preview(skin.id));
  modal.querySelector('.shop-category-grid').append(category);
}
