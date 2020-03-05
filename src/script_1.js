p5.DisableFriendlyErrors = true;
"use strict";

// とりあえずどうする？？
// いろんなバリエーションがあると思う。
// パターン1:テストモード。
// 自由にボールを追加、削除できるようにし、どのボールも引っ張って動かせるようにする。
// その際、追加するボールの質量、摩擦係数、などをいじれるようにした方がいいかも。
// 摩擦係数は0.005～0.045くらいで（適当）
// 速さの下限は0.001～0.1くらいで動かしてみる。

// パターン2:パターンモード
// 動かせるのは薄い灰色の球1つだけにして、他の球に当ててなんか・・するみたいな・・。

// 多分あれ、クリックした瞬間にボールのpositionが有効になって、そのあとのマウスベクトルとボールのpositionから
// 移動方向と強さが計算されて矢印でビジュアライズされる仕組みになってる。で、マウスを離すとそれにより計算される速度がその瞬間に再設定
// されるようですね。
// colorModeをHSBにして、100でmassFactorを割って、重いほど暗くなるようにする（1.0～2.0）
// そして、動かす場合には、saturationを70とかにしてわかりやすく！

// ボールの衝突音をhttps://soundeffect-lab.info/sound/various/various3.htmlさんの効果音ラボから拝借しました。
// 有難く使わせていただきたいと思います。感謝します！


let mySystem;

const AREA_WIDTH =  360;
const AREA_HEIGHT = AREA_WIDTH * 1.5;
const BALL_RADIUS = AREA_WIDTH * 0.045; // ボールの半径は0.045くらいにする。配置するときは0.05だと思って配置する。隙間ができる。OK!
const BALL_APPEAR_MARGIN = AREA_WIDTH * 0.005; // ボールの直径が0.1の中の0.09になるように配置するイメージで設定している。
const FRICTION_COEFFICIENT = 0.01; // 摩擦の大きさ
const SPEED_LOWER_LIMIT = AREA_WIDTH * 0.00025; // 速さの下限（これ以下になったら0として扱う）

const SPEED_UPPER_LIMIT = AREA_WIDTH * 0.05; // セットするスピードの上限。横幅の5%でいく。（ちょっと下げる）
const ARROWLENGTH_LIMIT = AREA_WIDTH * 0.6; // 矢印の長さの上限

//const BALL_HUE_PALETTE = [0, 11, 17, 40, 52, 64, 76, 90]; // 8種類
// MASS_FACTOR_PALETTEは廃止。代わりに1.5と2.0を画像付きで別に用意する。
//const BALL_MASS_FACTOR_PALETTE = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0]; // 10種類

// ColorBallの色はパレットから出すことにしました。
// 順に赤、オレンジ、黄色、緑、水色、青、紫、ピンク。その次は"#32cd32"（黄緑）でモード選択用。
const COLOR_PALETTE = ["#ff0000", "#ffa500", "#ffff00", "#008000", "#00bfff", "#0000cd", "#800080", "#ff1493", "#32cd32"];
const BALL_CAPACITY = 30; // 30個まで増やせるみたいな。

const CONFIG_WIDTH = AREA_WIDTH * 0.6; // コンフィグの横幅は舞台の60%位を想定。
// 0:ADD, 1:MOVE, 2:DELETE.

const prefix = "https://inaridarkfox4231.github.io/assets/shoot/";

let collideSound;

function preload(){
	collideSound = loadSound(prefix + "collide.mp3");
	// 0.8.0にしたらうまくいった。なんじゃい。やっぱcdn怖いな・・
}

function setup(){
	createCanvas(AREA_WIDTH + CONFIG_WIDTH, AREA_HEIGHT);
  colorMode(HSB, 100);
	noStroke();
  mySystem = new System();
  //ptn0();
}

function draw(){
  mySystem.update();
  mySystem.applyCollide();
  mySystem.draw();
}

// -------------------------------------------------------------------------------------------------------------------- //
// Ball.

// こっちをmassFactorとballGraphicにしてそれぞれ登録する。drawはballGraphicを当てはめる形。
class Ball{
	constructor(x, y, ballGraphic){
		this.position = createVector(x, y);
		this.velocity = createVector(0, 0);
		this.radius = BALL_RADIUS;
		this.friction = FRICTION_COEFFICIENT;
		this.massFactor = 1.0; // デフォルト1.0で統一。特別なクラスの場合に上書きする。
		this.graphic = ballGraphic;
	}
	setVelocity(speed, direction){
		this.velocity.set(speed * cos(direction), speed * sin(direction));
	}
	applyReflection(){
		if(this.position.x < this.radius || this.position.x > AREA_WIDTH - this.radius){
			const collisionPlaneNormalVectorX = createVector(1, 0);
			const distanceWithWall = (this.position.x < this.radius ? this.position.x : AREA_WIDTH - this.position.x);
			positionAdjustment(this.position, this.velocity, collisionPlaneNormalVectorX, distanceWithWall, this.radius);
			this.velocity = reflection(this.velocity, collisionPlaneNormalVectorX);
		}else if(this.position.y < this.radius || this.position.y > AREA_HEIGHT - this.radius){
			const collisionPlaneNormalVectorY = createVector(0, 1);
			const distanceWithWall = (this.position.y < this.radius ? this.position.y : AREA_HEIGHT - this.position.y);
			positionAdjustment(this.position, this.velocity, collisionPlaneNormalVectorY, distanceWithWall, this.radius);
			this.velocity = reflection(this.velocity, collisionPlaneNormalVectorY);
		}
	}
	applyFriction(){
		// 摩擦を与える
		this.velocity.mult(1 - this.friction);
	}
	update(){
		this.position.add(this.velocity);
		this.applyReflection();
		this.applyFriction();
		if(this.velocity.mag() < SPEED_LOWER_LIMIT){ this.velocity.set(0, 0); } // 速さの下限に達したら0にする。
	}
	draw(){
		image(this.graphic, this.position.x - this.radius * 1.2, this.position.y - this.radius * 1.2);
	}
}

class ColorBall extends Ball{
	constructor(x, y, ballGraphic, paleGraphic, colorId){
		super(x, y, ballGraphic, paleBallGraphic, colorId);
		this.paleGraphic = paleGraphic;
		this.colorId = colorId;
		this.pale = false;
		this.life = 120; // paleがtrueのとき減り続けて0になると消滅する
	}
	update(){
		super.update();
		if(this.pale){ this.life--; }
		// lifeが0のBallの排除はSystem側で行う。その際パーティクルを出したり、種類に応じてまあいろいろやる。
	}
	draw(){
		if(this.pale){
			image(this.paleGraphic, this.position.x - this.radius * 1.2, this.position.y - this.radius * 1.2);
		}else{
			image(this.graphic, this.position.x - this.radius * 1.2, this.position.y - this.radius * 1.2);
		}
	}
}

// グラフィックはボールによってはいじるかもだけどそこらへんは個別に対応できるし上書きできるからOK.

// 1.ColorBall. これは色のid情報をもつ。type:"color"で、同じ色と当たると発光したのち消滅する。
// 2.IceBall. これはtype:"ice"でグラフィックは雪の結晶っぽいのがくるくるまわる。で、パーティクルも工夫する。
// パーティクルは画像貼り付けでやりたい。いろいろ工夫できるようになるし。手裏剣と月を追加したい。
// 発光したボールとあたると中央の結晶の色がその色になって（基本薄い水色っぽいの）、同じ色のColorBallと当たるとそれも発光する。
// そのまま消滅。
// 3.ThunderBall. type:"thunder". これは発光中のColorBallが衝突したら消滅してその瞬間に同じ色のColorBallがすべて消滅する。
// 4.HeavyBall. type:"heavy". massFactorが2.0で摩擦係数も3倍の0.03にする。
// 5.WhiteBall. type:"white". 手玉とwhite以外のボールが当たった場合に消滅してそのボールと同じ種類のボールを同じ場所に出現させる。

// 3, 4, 5は発光しないので、継承で書いた方がいいね・・

// -------------------------------------------------------------------------------------------------------------------- //
// System.

class System{
  constructor(){
    this.balls = [];
		this.modeId = 0;
		this.boardId = 0;
		this.boardGraphic = createBoardGraphic(); // 背景工夫したいねって
		this.configGraphic = createConfigGraphic();  // コンフィグエリアのグラフィック
	  this.createButtons();
		this.shooter = new BallShooter();
		//this.colorId = 0;
		this.ballKindId = 0;
		this.ballGraphicArray = {}; // ボール画像. normalとpaleの2種類。
		this.ballGraphicArray.normal = [];
		this.ballGraphicArray.pale = [];
		// とりあえず現時点ではnormal8つとpale8つかな。iceBallにもpaleあるし。つまり9つまで。normalは12個までって感じかな。
		/*
		for(let i = 0; i < BALL_HUE_PALETTE.length; i++){
			const hue = BALL_HUE_PALETTE[i];
			this.ballGraphicArray.push(createBallGraphic(hue, 100));
		}
		*/
		for(let i = 0; i < 8; i++){
			this.ballGraphicArray.normal.push(createBallGraphic(i));
			this.ballGraphicArray.pale.push(createBallGraphic(i, 0.7)); // 0.7はpaleRatioでこれにより薄くなる感じ。
		}
		// 8, 9, 10, 11は今後・・
		// このあと種類を増やすことを考えると、colorIdよりballKindIdとした方が意味的にいいと思う。
		// で、0～7をColorBall生成時の色のidとして採用すればいい。
  }
	getModeId(){
		return this.modeId;
	}
	createButtons(){
		const w = CONFIG_WIDTH;
		const h = AREA_HEIGHT;
    // 背景選択用ボタン
		this.boardButtons = new ButtonSet();
		let atv = this.boardGraphic.active;
		let inAtv = this.boardGraphic.inActive;
		this.boardButtons.addNormalButton(w * 0.03, h * 0.21, w * 0.164, h * 0.08, atv[0], inAtv[0]);
		this.boardButtons.addNormalButton(w * 0.224, h * 0.21, w * 0.164, h * 0.08, atv[1], inAtv[1]);
		this.boardButtons.addNormalButton(w * 0.438, h * 0.21, w * 0.164, h * 0.08, atv[2], inAtv[2]);
		this.boardButtons.addNormalButton(w * 0.632, h * 0.21, w * 0.164, h * 0.08, atv[3], inAtv[3]);
		this.boardButtons.addNormalButton(w * 0.826, h * 0.21, w * 0.164, h * 0.08, atv[4], inAtv[4]);
		this.boardButtons.initialize();
    // ボールの種類を選択する為のボタン
		// ballButtonsに改名。
		this.ballButtons = new ButtonSet();
		this.ballButtons.addColorButton(w * 0.02, h * 0.505, w * 0.225, h * 0.09, 0);
		this.ballButtons.addColorButton(w * 0.265, h * 0.505, w * 0.225, h * 0.09, 1);
		this.ballButtons.addColorButton(w * 0.51, h * 0.505, w * 0.225, h * 0.09, 2);
		this.ballButtons.addColorButton(w * 0.755, h * 0.505, w * 0.225, h * 0.09, 3);
		this.ballButtons.addColorButton(w * 0.02, h * 0.605, w * 0.225, h * 0.09, 4);
		this.ballButtons.addColorButton(w * 0.265, h * 0.605, w * 0.225, h * 0.09, 5);
		this.ballButtons.addColorButton(w * 0.51, h * 0.605, w * 0.225, h * 0.09, 6);
		this.ballButtons.addColorButton(w * 0.755, h * 0.605, w * 0.225, h * 0.09, 7);
		this.ballButtons.initialize();
    // モードを変更する為のボタン
		this.modeButtons = new ButtonSet();
		this.modeButtons.addColorButton(w * 0.025, h * 0.9, w * 0.3, h * 0.08, 8, "ADD");
		this.modeButtons.addColorButton(w * 0.35, h * 0.9, w * 0.3, h * 0.08, 8, "MOV");
		this.modeButtons.addColorButton(w * 0.675, h * 0.9, w * 0.3, h * 0.08, 8, "DEL");
		this.modeButtons.initialize();
	}
	activateButton(){
		// 他の種類のボタンもできるようにボタンをまとめたクラスを用意すべきかもね。
    const x = mouseX - AREA_WIDTH;
		const y = mouseY;
		if(x < 0 || x > CONFIG_WIDTH || y < 0 || y > AREA_HEIGHT){ return; }
    // 一旦activeになってるところをinActivateしたうえで、必要なら更新して、それからactivateする。
		this.boardButtons.activateButton(x, y);
		this.boardId = this.boardButtons.getActiveButtonId();
		this.modeButtons.activateButton(x, y);
		this.modeId = this.modeButtons.getActiveButtonId();
	  //this.colorButtons.activateButton(x, y);
		//this.colorId = this.colorButtons.getActiveButtonId();
		this.ballButtons.activateButton(x, y);
		this.ballKindId = this.ballButtons.getActiveButtonId();
	}
	addBallCheck(x, y){
		// 最初に個数の確認
		if(this.balls.length > BALL_CAPACITY){ return false; }
		// (x, y)の位置を中心とするある程度の半径のボールが出現させられるかどうか。
		// 具体的には既存のボールと位置が一定以上かぶらないこと、さらに壁にめり込まないことが条件。trueかfalseを返すbool値の関数。
    for(let b of this.balls){
			if(dist(b.position.x, b.position.y, x, y) < BALL_RADIUS * 2 + BALL_APPEAR_MARGIN){ return false; }
		}
		// これ別やん・・壁の近くには置けないようにする
		if(x < BALL_RADIUS + BALL_APPEAR_MARGIN || x > AREA_WIDTH - BALL_RADIUS - BALL_APPEAR_MARGIN){ return false; }
		if(y < BALL_RADIUS + BALL_APPEAR_MARGIN || y > AREA_HEIGHT - BALL_RADIUS - BALL_APPEAR_MARGIN){ return false; }
		// もろもろ潜り抜けたらOK.
		return true;
	}
  addBall(x, y){
    // Ballを追加する
		// kind < 8の場合はColorBallだけどそれ以降はスイッチしたほうがいいかも？Colorならpale画像も必要だし。
		//this.balls.push(new Ball(x, y, this.ballGraphicArray[this.colorId]));
		// そのうちColorBallにしてpale画像も付与するけど今はこれでいい。
		this.balls.push(new Ball(x, y, this.ballGraphicArray.normal[this.ballKindId]));
  }
  findBall(x, y){
    // Ballが(x, y)にあるかどうか調べてあればそのボールのidを返すがなければ-1を返す。
    for(let i = 0; i < this.balls.length; i++){
      const _ball = this.balls[i];
      if(dist(_ball.position.x, _ball.position.y, x, y) < _ball.radius){ return i; }
    }
    return -1;
  }
	setShootingBall(id){
		// id番のボールをセットする。
		this.shooter.setTarget(this.balls[id]);
	}
	shootBall(){
		// セットしたボールを離す。
		this.shooter.shoot();
		// ボールが動くかどうかにかかわらずリリースする。
		this.shooter.release();
	}
	deleteBall(id){
    // Ballを削除する
    this.balls.splice(id, 1);
  }
  update(){
    for(let b of this.balls){ b.update(); }
  }
  applyCollide(){
    for(let ballId = 0; ballId < this.balls.length; ballId++){
  		const _ball = this.balls[ballId];
  		for(let otherId = ballId + 1; otherId < this.balls.length; otherId++){
  			const _other = this.balls[otherId];
  			if(!collisionCheck(_ball, _other)){ continue; }
  			perfectCollision(_ball, _other);
  		}
  	}
  }
  draw(){
		image(this.boardGraphic.active[this.boardId], 0, 0);
    for(let b of this.balls){ b.draw(); }
    this.shooter.draw(); // うまくいくか
    this.drawConfig();
  }
  drawConfig(){
		// ここでconfigGraphicをいじる、というかここは毎フレーム描く。
		let gr = this.configGraphic;
		gr.background(70);
		const w = CONFIG_WIDTH;
		const h = AREA_HEIGHT;
		// 全部同じ色でいいよ。茶色かなんかで。で、違うときは暗くする。
		// これでいいんだけど、今まで通りのこの方法だとマウスクリックとの紐付けが非常に面倒なので、何とかしたいです。
		// ボタンをクラス化しました～
		this.boardButtons.draw(gr);
		this.modeButtons.draw(gr);
		//this.colorButtons.draw(gr);
		this.ballButtons.draw(gr);
		image(this.configGraphic, AREA_WIDTH, 0);
  }
}

// -------------------------------------------------------------------------------------------------------------------- //
// Button.
// ADD:ボールを追加する。
// MOV:ボールを動かす。
// DEL:ボールを削除する。

// 提案なんだけどアニメーションつけないかい？
// 30フレームくらいの。で、アニメーションが終わったらactivate, inActivateする
// アニメーション中に他をクリックしちゃったらとかあるのでモードチェンジの際にアニメを切れるようにする。
// まあもろもろ揃えてからでいいよ。

// 色ボタンはテキストなしで。
// サイズボタンは1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0の10種類。
// モードボタンはADD, MOV, DELの3種類。
class Button{
	constructor(left, top, w, h){
		this.left = left;
		this.top = top;
		this.w = w;
		this.h = h;
		this.active = false;
	}
	activate(){
		this.active = true;
	}
	inActivate(){
		this.active = false;
	}
	hit(x, y){
		// クリック位置がボタンに触れてるかどうかをこれで判定する。
		return this.left < x && x < this.left + this.w && this.top < y && y < this.top + this.h;
	}
	draw(gr){
		// activeなときとactiveでないときで描画の仕方を変えるんだけどその指定の仕方で別クラスにする。
	}
}

// Buttonを2種類作る。
// 今まで通りのパレットのやつはColorButtonで背景選択用のやつはNormalButtonでこれはactiveなときとそうでない時の
// それぞれの画像を用意して持たせる。だからそこだけ変える。
// 廃止しません。ごめんね！
// あ、そうか、ColorButtonの定義を変えちゃえばいいんだ。constructorで作っちゃえばいい。その際paleRatioも指定しちゃおう。
class ColorButton extends Button{
	constructor(left, top, w, h, colorId, innerText = ""){
		super(left, top, w, h);
		//this.hue = hue;
		this.activeGraphic = createColorButtonGraphic(w, h, colorId, 0.0, innerText);
		this.inActiveGraphic = createColorButtonGraphic(w, h, colorId, 0.7, innerText);
		//this.innerText = innerText;
	}
	draw(gr){
		if(this.active){
			gr.image(this.activeGraphic, this.left, this.top);
		}else{
			gr.image(this.inActiveGraphic, this.left, this.top);
		}
		// activeでないときは色を暗くする。
		/*
		if(this.active){
			gr.fill(this.hue, 100, 100);
		}else{
			gr.fill(this.hue, 100, 50);
		}
		gr.rect(this.left, this.top, this.w, this.h);
		gr.fill(0);
		gr.textSize(this.h / 2);
		gr.textAlign(CENTER, CENTER);
		gr.text(this.innerText, this.left + (this.w / 2), this.top + (this.h / 2));
		*/
	}
}

// 2つの画像を用意してactiveに応じて切り替える。
// ボール選択とモード選択は薄い色にしたい感じ。ここには書かないけど。
// 背景選択の方ではサムネイルのようにして使う。
class NormalButton extends Button{
	constructor(left, top, w, h, activeGraphic, inActiveGraphic){
		super(left, top, w, h);
		this.activeGraphic = activeGraphic;
		this.inActiveGraphic = inActiveGraphic;
	}
	draw(gr){
		if(this.active){
			gr.image(this.activeGraphic, this.left, this.top, this.w, this.h, 0, 0, AREA_WIDTH, AREA_HEIGHT);
		}else{
			gr.image(this.inActiveGraphic, this.left, this.top, this.w, this.h, 0, 0, AREA_WIDTH, AREA_HEIGHT);
		}
	}
}

class ButtonSet{
	constructor(){
		this.buttons = [];
		this.activeButtonId = 0;
	}
	initialize(){
		this.buttons[0].activate();
	}
	getActiveButtonId(){
		return this.activeButtonId;
	}
	addColorButton(left, top, w, h, hue, innerText = ""){
		// ColorButtonを追加する
		this.buttons.push(new ColorButton(left, top, w, h, hue, innerText));
	}
	addNormalButton(left, top, w, h, activeGraphic, inActiveGraphic){
		// NormalButtonを追加する
		this.buttons.push(new NormalButton(left, top, w, h, activeGraphic, inActiveGraphic));
	}
	activateButton(x, y){
		// (x, y)がボタンをactivateさせるなら変更する。
		this.buttons[this.activeButtonId].inActivate();
		for(let i = 0; i < this.buttons.length; i++){
			if(this.buttons[i].hit(x, y)){ this.activeButtonId = i; }
		}
		this.buttons[this.activeButtonId].activate();
	}
	draw(gr){
		for(let btn of this.buttons){ btn.draw(gr); }
	}
}

// -------------------------------------------------------------------------------------------------------------------- //
// BallShooter.
// 煩雑になりそうなのでコンポジットにします（その方がいい）（カオスになる）

// activeが解除されるのはマウスリリース時。矢印はマウス位置が・・あ、なるほど。
class BallShooter{
  constructor(){
		this.target = undefined;
		this.active = false;
	}
	isActive(){
		return this.active; // リリースの時にここを見てactiveならshootする。
	}
	setTarget(_ball){
		this.target = _ball;
		this.active = true;
	}
	release(){
		this.active = false;
		this.target = undefined;
	}
	getArrowLength(){
		// 矢印の長さを計算する。ターゲットの中心からマウスまでの距離ーBALL_RADIUSで上限は横幅の6割。
		// BALL_RADIUSを足さないと矢印の長さがきちんとあれにならない。
		return min(dist(this.target.position.x, this.target.position.y, mouseX, mouseY), ARROWLENGTH_LIMIT + BALL_RADIUS) - BALL_RADIUS;
	}
	shoot(){
		// activeでないときは何もしない。
		if(!this.active){ return; }
		// ボールにスピードをセットするメソッド
    const arrowLength = this.getArrowLength();
		if(arrowLength <= 0){ return; }
		const speed = arrowLength * SPEED_UPPER_LIMIT / ARROWLENGTH_LIMIT;
		const direction = atan2(mouseY - this.target.position.y, mouseX - this.target.position.x);
		this.target.setVelocity(speed, direction);
    // releaseはshootのたびに呼び出した方がいいのでここには書かない方がいいと思う。
	}
	draw(){
		if(!this.active){ return; }
		// 長さの上限はAREA_WIDTH * 0.6（必要なら定数化するけど）.
		const arrowLength = this.getArrowLength();
		if(arrowLength <= 0){ return; }
		const direction = atan2(mouseY - this.target.position.y, mouseX - this.target.position.x);
		let start = createVector(BALL_RADIUS * cos(direction), BALL_RADIUS * sin(direction));
		let end = createVector((BALL_RADIUS + arrowLength) * cos(direction), (BALL_RADIUS + arrowLength) * sin(direction));
		start.add(this.target.position);
		end.add(this.target.position);
		stroke(55 + 45 * (arrowLength / ARROWLENGTH_LIMIT), 100, 100);
		strokeWeight(6.0);
		line(start.x, start.y, end.x, end.y);
    let upperArrow = createVector((arrowLength * 0.3) * cos(direction + PI * 0.85), (arrowLength * 0.3) * sin(direction + PI * 0.85));
		let lowerArrow = createVector((arrowLength * 0.3) * cos(direction - PI * 0.85), (arrowLength * 0.3) * sin(direction - PI * 0.85));
		upperArrow.add(end);
		lowerArrow.add(end);
		line(end.x, end.y, upperArrow.x, upperArrow.y);
		line(end.x, end.y, lowerArrow.x, lowerArrow.y);
		noStroke();
	}
}

// -------------------------------------------------------------------------------------------------------------------- //
// Functions for collide.

function collisionCheck(_ball, _other){
  return p5.Vector.dist(_ball.position, _other.position) < _ball.radius + _other.radius;
}

// まずball.massFactorとball.velocityとotherのそれから重心のベクトルを出してそれを使って相対速度を作って
// それに対して衝突面の法線ベクトル、これはpositionのsubを取るだけ。これで相対速度を反射させる。
// 最後に重心ベクトルを足しなおせば完成（のはず）
function perfectCollision(_ball, _other){
	// ballとotherが衝突したときの速度の変化を記述する（面倒なので完全弾性衝突で）
	// その前に、双方が下限速度の場合は何もしないこととする。
	if(_ball.velocity.mag() < SPEED_LOWER_LIMIT && _other.velocity.mag() < SPEED_LOWER_LIMIT){ return; }
	// 重心ベクトル
	const g = getCenterVector(_ball, _other);
	// 相対速度
	let u = p5.Vector.sub(_ball.velocity, g);
	let v = p5.Vector.sub(_other.velocity, g);
	const collisionPlaneNormalVector = p5.Vector.sub(_ball.position, _other.position);
	// ここに位置の調整を挟む
	// 双方が接するように位置を後退させる、割と複雑な処理。
	// 具体的にはダブった時の中心同士の中点から中心を重心ベースの速度に沿って後退させて半径だけ離れたところまでもっていく感じ。そうすると接する。
	const distanceWithWall = p5.Vector.dist(_ball.position, _other.position) / 2;
	// どうもこのu.mag()が0になってるのがまずかったっぽい。
	const c = abs(p5.Vector.dot(u, collisionPlaneNormalVector)) / (u.mag() * collisionPlaneNormalVector.mag());
	const multiplier = sqrt(_ball.radius * _ball.radius - distanceWithWall * distanceWithWall * (1 - c * c));
	const adjustedDistance = distanceWithWall * (1 - c * c) + c * multiplier;
	positionAdjustment(_ball.position, u, collisionPlaneNormalVector, distanceWithWall, adjustedDistance);
	positionAdjustment(_other.position, v, collisionPlaneNormalVector, distanceWithWall, adjustedDistance);
	// 位置が変わったので接触面の法線ベクトルを再計算しないといけない。
  const newNormalVector = p5.Vector.sub(_ball.position, _other.position);
	u = reflection(u, newNormalVector);
	v = reflection(v, newNormalVector);
	_ball.velocity = p5.Vector.add(u, g);
	_other.velocity = p5.Vector.add(v, g);
	collideSound.play();
}

function getCenterVector(_ball, _other){
  const multiplier = 1 / (_ball.massFactor + _other.massFactor);
	const u = p5.Vector.mult(_ball.velocity, _ball.massFactor);
	const v = p5.Vector.mult(_other.velocity, _other.massFactor);
	return p5.Vector.mult(p5.Vector.add(u, v), multiplier);
}

// distanceWithWallは壁との衝突の場合は壁に応じてそれとpositionの垂直距離、
// 衝突の場合は相手とのpositionの差を2で割ったものとする。

// どうもね、衝突の場合は重心座標系でやらないとだめっぽいね。
// 当たり前といえば当たり前だ・・だって重心座標系にしたから壁の反射で計算できてるんでしょ。
// だからそれ相応の速度を使わないとね・・。

// 衝突の場合は_ball.radiusではなくて、・・壁の場合はadjustedDistanceは普通に半径でいいんだけど、
// 衝突では位置ずらした時に接していないといけなくってそこら辺でバグってるみたい。
function positionAdjustment(p, v, n, d, adjDist){
	// d:distanceWithWall.
	// 要するにめりこみ処理・・うまくいくか知らないけど。_ballの速度の情報を元に位置をずらす感じですかね。subで。
	// 計算によると長さが(radius - distanceWithWall)x|v||n|/|(v・n)|で方向はvと同じ。
	// だから計算上は_ballのvに(r-d)*|n|/|(v・n)|を掛ける形になる。可読性は落ちるけど。
	const multiplier = (adjDist - d) * n.mag() / abs(p5.Vector.dot(v, n));
	p.sub(p5.Vector.mult(v, multiplier));
	// 大丈夫？？
}

function reflection(v, n){
	// nは壁の法線ベクトル(normalVector)。これにより反射させる。
	// nとして、v→v - 2(v・n)nという計算を行う。
	// nが単位ベクトルでもいいように大きさの2乗（n・n）で割るか・・（collisionでも使うので）
	return p5.Vector.sub(v, p5.Vector.mult(p5.Vector.mult(n, 2), p5.Vector.dot(v, n) / p5.Vector.dot(n, n)));
}

// -------------------------------------------------------------------------------------------------------------------- //
// Interaction.
// 追加モードで何もないところをクリックした場合、他のボールと衝突しないようなら（壁にめり込んでもダメ）ボールを発生させることができる。
// 移動モードでボールをクリックするとボールと紐付けされてボール位置からマウス位置に向かって矢印が出る、
// ボールと重ねた状態でリリースするとキャンセル、リリースすると矢印の方向に飛ぶ。
// 削除モードの時にクリックするとボールがなければ空振り、あればそれを排除する。
// 設定する速さはMAX30位、矢印の長さはAREA_WIDTHの半分まで伸びる感じで。色は黒系で長いほど濃くなるイメージで。

// MOVE, 面倒なのでボール位置からマウス位置に向かわせる。
function mousePressed(){
	const x = mouseX;
	const y = mouseY;
	mySystem.activateButton();
	// 各種色変え、重さ替えなど。色変えは普通にパレット。重さ替えは灰色のグラデーションで数字書いてね。
	if(x > AREA_WIDTH){ return; }
	switch(mySystem.getModeId()){
		case 0:
		  /* ADD */
			if(mySystem.addBallCheck(x, y)){ mySystem.addBall(x, y); }
			break;
		case 1:
		  /* MOVE */
			const shootingBallId = mySystem.findBall(x, y);
			if(shootingBallId >= 0){ mySystem.setShootingBall(shootingBallId); }
			break;
		case 2:
		  /* DELETE */
			const deletingBallId = mySystem.findBall(x, y);
			if(deletingBallId >= 0){ mySystem.deleteBall(deletingBallId); }
			break;
	}
  return false;
}


function mouseReleased(){
	switch(mySystem.getModeId()){
		case 1:
		  /* MOVE */
			mySystem.shootBall();
			break;
	}
  return false;
}

// -------------------------------------------------------------------------------------------------------------------- //
// Graphics.

// 背景。
function createBoardGraphic(){
	let activeGrArray = [];
	let inActiveGrArray = [];
	const w = AREA_WIDTH;
	const h = AREA_HEIGHT;
	activeGrArray.push(rectLikeBoard(w, h, 100));
	activeGrArray.push(triLikeBoard(w, h, 100));
	activeGrArray.push(diaLikeBoard(w, h, 100));
	activeGrArray.push(starLikeBoard(w, h, 100));
	activeGrArray.push(ellipseLikeBoard(w, h, 100));
	inActiveGrArray.push(rectLikeBoard(w, h, 50));
	inActiveGrArray.push(triLikeBoard(w, h, 50));
	inActiveGrArray.push(diaLikeBoard(w, h, 50));
	inActiveGrArray.push(starLikeBoard(w, h, 50));
	inActiveGrArray.push(ellipseLikeBoard(w, h, 50));
	return {active:activeGrArray, inActive:inActiveGrArray};
}

// 背景いろいろ～
// 長方形ぐるぐる
function rectLikeBoard(w, h, blt){
	let gr = createGraphics(w, h);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.rectMode(CENTER);
	gr.translate(w / 2, h / 2);
	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		gr.fill(70, 90 * (1 - prg), blt);
		gr.rect(0, 0, w * (1 - prg), h * (1 - prg));
		gr.rotate(2 * PI * random(0.05, 0.15));
	}
	return gr;
}

// 三角形ぐるぐる
function triLikeBoard(w, h, blt){
	let gr = createGraphics(w, h);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.translate(w / 2, h / 2);
	const maxLength = sqrt(w * w + h * h);
	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		gr.fill(54, 100 * (1 - prg * prg), blt);
		const a = maxLength * (1 - prg);
		gr.triangle(a, 0, a * cos(PI * 2 / 3), a * sin(PI * 2 / 3), a * cos(PI * 4 / 3), a * sin(PI * 4 / 3));
		gr.rotate(2 * PI * random(0.1, 0.2));
	}
	return gr;
}

// ダイヤぐるぐる
function diaLikeBoard(w, h, blt){
	let gr = createGraphics(w, h);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.translate(w / 2, h / 2);
	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		gr.fill(5, 100 * (1 - prg * prg), blt);
		const w1 = w * (1 - prg);
		const h1 = h * (1 - prg);
		gr.quad(w1, 0, 0, h1, -w1, 0, 0, -h1);
		gr.rotate(2 * PI * random(0.05, 0.15));
	}
	return gr;
}

// 星型ぐるぐる
function starLikeBoard(w, h, blt){
	let gr = createGraphics(w, h);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.translate(w / 2, h / 2);
	const maxLength = 0.5 * sqrt(w * w + h * h);
	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		gr.fill(82, 100 * (1 - prg * prg), blt);
    const a = maxLength * (1 - prg) / sin(PI / 10);
		const b = maxLength * (1 - prg) / cos(PI / 5);
    let p = [];
		for(let t = 0; t < 5; t++){
			p.push({x:a * sin(2 * PI * t / 5), y:a * cos(2 * PI * t / 5)});
		}
		p.push({x:0, y:-b});
		gr.triangle(p[1].x, p[1].y, p[4].x, p[4].y, p[5].x, p[5].y);
		gr.quad(p[0].x, p[0].y, p[2].x, p[2].y, p[5].x, p[5].y, p[3].x, p[3].y);
		gr.rotate(2 * PI * random(0.15, 0.2));
	}
	return gr;
}

// 楕円ぐるぐる
function ellipseLikeBoard(w, h, blt){
	let gr = createGraphics(w, h);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.translate(w / 2, h / 2);
	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		gr.fill(91, 100 * (1 - prg), blt);
		gr.ellipse(0, 0, w * 2 * (1 - prg), h * 2 * (1 - prg));
		gr.rotate(2 * PI * random(0.25, 0.35));
	}
	return gr;
}

// ConfigBoard. もろもろは毎度更新するのでベースだけ。
function createConfigGraphic(){
	let gr = createGraphics(CONFIG_WIDTH, AREA_HEIGHT);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	return gr;
}

// maxSaturationから0に近づけていくグラデーション。
// あえて若干大きめに取ってあります。
// なんか、こうしないと色々まずいみたいなので。描画の際にも1.2倍にしてる・・原因は不明。
// まあ若干無茶なグラデーションしてるからそこら辺でしょ。
/*
function createBallGraphic(hue, maxSaturation){
	let gr = createGraphics(BALL_RADIUS * 2.4, BALL_RADIUS * 2.4);
	gr.colorMode(HSB, 100);
	gr.noStroke();
	gr.translate(BALL_RADIUS * 1.2, BALL_RADIUS * 1.2);

	for(let i = 0; i < 100; i++){
		let prg = i / 100;
		prg = 1 - sqrt(1 - prg * prg);
		gr.fill(hue, maxSaturation * (1 - prg), 100);
		gr.circle(0, 0, 2 * BALL_RADIUS * (1 - prg));
	}
	return gr;
}
*/

// ボール画像作り直し。paleRatioは0.0がデフォで1.0に近づくと白くなる。
// lerpなんかおかしいので不採用
function createBallGraphic(colorId, paleRatio = 0.0){
	let gr = createGraphics(BALL_RADIUS * 2.4, BALL_RADIUS * 2.4);
	gr.noStroke();
	gr.translate(BALL_RADIUS * 1.2, BALL_RADIUS * 1.2);
	const ballColor = color(COLOR_PALETTE[colorId]);
	// r, g, b値を取得する。
	const z = {r:red(ballColor), g:green(ballColor), b:blue(ballColor)};
	// 中心が白くなるグラデーションをかける。
	for(let i = 0; i < 100; i++){
		const prg = 0.5 * (1 - cos(PI * (i / 100)));
		// lerpなんかおかしいから使うのやめた。
		const paled = paleRatio + (1 - paleRatio) * prg;
		gr.fill(z.r + (255 - z.r) * paled, z.g + (255 - z.g) * paled, z.b + (255 - z.b) * paled);
		gr.circle(0, 0, 2 * BALL_RADIUS * (1 - i / 100));
	}
	return gr;
}

// ボタン画像作る。色用と、それ以外。モード選択には別の色を使うつもり。黄緑系とかその辺。
// ColorButtonの定義のところで作ります。アイスとかサンダーは別の関数で作ります。
// モードとカラーボール選択はここで作りましょう。
// lerpColorなんかおかしいので不採用（うんざり）
function createColorButtonGraphic(w, h, colorId, paleRatio = 0.0, innerText = ""){
  let gr = createGraphics(w, h);
	gr.rectMode(CENTER);
	gr.noStroke();
	const edgeLength = min(w, h) * 0.1;
	const ballColor = color(COLOR_PALETTE[colorId]);
	// r, g, b値を取得する。
	let z = {r:red(ballColor), g:green(ballColor), b:blue(ballColor)};
	// paleRatioを反映させる。
	z = {r:z.r + (255 - z.r) * paleRatio, g:z.g + (255 - z.g) * paleRatio, b:z.b + (255 - z.b) * paleRatio};
	//gr.fill(lerpColor(properColor, color(255), 0.3));
	gr.fill(z.r + (255 - z.r) * 0.3, z.g + (255 - z.g) * 0.3, z.b + (255 - z.b) * 0.3);
	gr.rect(w / 2, h / 2, w, h);
	//gr.fill(lerpColor(properColor, color(0), 0.3));
	gr.fill(z.r * 0.7, z.g * 0.7, z.b * 0.7);
	gr.rect(w / 2 + edgeLength * 0.5, h / 2 + edgeLength * 0.5, w - edgeLength, h - edgeLength);
	//gr.fill(properColor);
	gr.fill(z.r, z.g, z.b);
	gr.rect(w / 2, h / 2, w - edgeLength * 2, h - edgeLength * 2);
	if(innerText === ""){ return gr; }
	gr.fill(0);
	gr.textSize(h / 2);
	gr.textAlign(CENTER, CENTER);
	gr.text(innerText, w / 2, h / 2);
	return gr;
}

// ボタンを作る。やっぱColorButtonは廃止かな・・全部NormalButtonにする流れで。テキストとかも必要なら用意する感じで。
// とりあえず色とテキストだけのボタンをモード変更用とカラーボール選択用に作る。
// アイスボールとかそっちは個別に関数を作る。ColorButtonは一応残しておくけど実質廃止みたいな感じかな・・
// hueはやめてパレットには16進数コードを載せておく。これ使ってボールの画像とか作る。ボール画像はwhiteとの距離を縮めることで
// 発光時のグラフィックを作れるようにしよう。
// ボードの方は色暗くしたけど、こっちは逆にinActiveなときは色を薄くしたい。ボールと揃えたいね。以上。

// -------------------------------------------------------------------------------------------------------------------- //
// Pattern.
// まあ、ボール作って速度与えてってやろうと思えばできるからね・・インタラクションないけど面白いとは思う（わからんけどね）。
// はい。冗談おわり。デバッグしようね・・・

function ptn0(){
  let b_self = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 0.2, 0);
  let b_top = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 0.7, 7);
  let b1 = new Ball(AREA_WIDTH * 0.45, AREA_WIDTH * 0.8, 1);
  let b2 = new Ball(AREA_WIDTH * 0.55, AREA_WIDTH * 0.8, 1);
  let b3 = new Ball(AREA_WIDTH * 0.4, AREA_WIDTH * 0.9, 2);
  let b4 = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 0.9, 2);
  let b5 = new Ball(AREA_WIDTH * 0.6, AREA_WIDTH * 0.9, 2);
  let b6 = new Ball(AREA_WIDTH * 0.35, AREA_WIDTH * 1.0, 3);
  let b7 = new Ball(AREA_WIDTH * 0.45, AREA_WIDTH * 1.0, 3);
  let b8 = new Ball(AREA_WIDTH * 0.55, AREA_WIDTH * 1.0, 3);
  let b9 = new Ball(AREA_WIDTH * 0.65, AREA_WIDTH * 1.0, 3);
	let b10 = new Ball(AREA_WIDTH * 0.3, AREA_WIDTH * 1.1, 4);
  let b11 = new Ball(AREA_WIDTH * 0.4, AREA_WIDTH * 1.1, 4);
  let b12 = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 1.1, 4);
  let b13 = new Ball(AREA_WIDTH * 0.6, AREA_WIDTH * 1.1, 4);
  let b14 = new Ball(AREA_WIDTH * 0.7, AREA_WIDTH * 1.1, 4);

  b_self.setVelocity(35, PI / 2 - 0.1);
  mySystem.balls = [b_self, b_top, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14];
}

// だめだ。めり込み処理やらないとおかしなことになる（特に見栄えが）。
// ちゃんと動いてるけどね・・きびしいな・・・

// 重心座標系でやるの？なるほど・・なんかおかしいと思った。じゃあuとvをそういうものとしてやるのね。んー・・むぅ。
// よく考えたら速度についてはいじってないんだっけね。

// だからー、壁の場合はそのままでいいんだけど、ぶつかる場合は、positionのずらし方を変える。
// 接するところまで戻す。で、そのうえで接触面を計算して、反射させるんだね（複雑・・）

// 多分接するところまで戻せたはず。さて、本題に入るんだが・・（気力）
