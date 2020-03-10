p5.DisableFriendlyErrors = true;
"use strict";

// テストモード。
// 自由にボールを追加、削除できるようにし、どのボールも引っ張って動かせるようにする。
// その際、追加するボールの質量、摩擦係数、などをいじれるようにした方がいいかも。
// って思ったけど気が向いたらでいいや。

// そのうち手玉作ってそれ以外動かせないようにするか、
// もしくは今背景変えてるところでモードを変えるとか？んー・・
// 手玉しか動かせないならどこでマウスダウンしても矢印出た方がよさそう

// ボールの衝突音をhttps://soundeffect-lab.info/sound/various/various3.htmlさんの効果音ラボから拝借しました。
// 有難く使わせていただきたいと思います。感謝します！


// 課題
// オーバーヘッドの負荷が重いのをなんとかしたいのと
// パーティクル出す、NearColorで星型でいいです。NearColorはあそこから取り出す。ボールの色。
// パーティクルはhopプロパティがonのときにジャンプするようにしたい。
// あと画像貼り付けでやりたいけどいいのかな（負荷が分からん）

// 大きさの違うボール同士の衝突も実装してみたい
// そこまではやる（再利用したいし）
// エネルギーが失われる衝突とか実装してみたい（反発係数を実装する）

let mySystem;

const AREA_WIDTH =  360;
const AREA_HEIGHT = AREA_WIDTH * 2.0;
const GUTTER_PROPORTION = 1 / 12;

const ORIGIN_BALL_RADIUS = 100; // 画像用の半径。これを元にボール画像を作って、個別の描画ではこれを渡して適切に拡縮して使う。

const BALL_SPACE = AREA_WIDTH * (1 / 18);
const BALL_RADIUS = BALL_SPACE * 0.98; // ボールの半径は0.045くらいにする。配置するときは0.05だと思って配置する。隙間ができる。OK!
const BALL_APPEAR_MARGIN = BALL_SPACE * 0.01; // ボールの直径が0.1の中の0.09になるように配置するイメージで設定している。
const FRICTION_COEFFICIENT = 0.02; // 摩擦の大きさ（0.01から0.02に上げてみた）
const SPEED_LOWER_LIMIT = AREA_WIDTH * 0.00025; // 速さの下限（これ以下になったら0として扱う）

const SPEED_UPPER_LIMIT = AREA_WIDTH * 0.08; // セットするスピードの上限。横幅の5%でいく。（ちょっと下げる）
const ARROWLENGTH_LIMIT = AREA_WIDTH * 0.6; // 矢印の長さの上限

// ColorBallの色はパレットから出すことにしました。
// 順に赤、オレンジ、黄色、緑、水色、青、紫、ピンク。その次は"#32cd32"（黄緑）でモード選択用。
// 9番目としてアイスボールが消えるときの色。シアンにする。
// 10番目としてサンダーボールが消えるときの色。ゴールドにする。
// 11番目。ヘビーボールは灰色。ガーター作らないとな・・
const COLOR_PALETTE = ["#ff0000", "#ffa500", "#ffff00", "#008000", "#00bfff", "#0000cd", "#800080", "#ff1493", "#32cd32",
                       "#00a1e9", "#ffd700", "#888"];
// たとえば色によってサイズを変えるのであれば
// const SIZE_FACTOR = [1.0, 1.2, 1.4, 1.6, 1.8, etc...]
// とかしてその値を使うことになるかな・・
const BALL_CAPACITY = 30; // 30個まで増やせるみたいな。

const CONFIG_WIDTH = AREA_WIDTH * 0.6; // コンフィグの横幅は舞台の60%位を想定。

// particle関連
let particlePool;
const EMPTY_SLOT = Object.freeze(Object.create(null)); // ダミーオブジェクト

const PARTICLE_LIFE = 60; // 寿命
const PARTICLE_ROTATION_SPEED = 0.12; // 形状の回転スピード
const MIN_DISTANCE = 30; // 到達距離
const MAX_DISTANCE = 60;
const MIN_RADIUS = 6; // 大きさ
const MAX_RADIUS = 24;
// const PARTICLE_NUM = 20; // 一度に出力する個数 → 廃止

const prefix = "https://inaridarkfox4231.github.io/assets/shoot/";

let collideSound;

function preload(){
	collideSound = loadSound(prefix + "collide.mp3");
	// 0.8.0にしたらうまくいった。なんじゃい。やっぱcdn怖いな・・
}

function setup(){
	createCanvas(AREA_WIDTH + CONFIG_WIDTH, AREA_HEIGHT);
  //colorMode(HSB, 100);
	noStroke();
	particlePool = new ObjectPool(() => { return new Particle(); }, 512);
  mySystem = new System();
  //ptn0();
  createStage0(mySystem);
}

function draw(){
  mySystem.update();
  mySystem.applyCollide();
	mySystem.applyGutter();
  mySystem.draw();
	mySystem.removeObjects();
}

// -------------------------------------------------------------------------------------------------------------------- //
// Ball.

// こっちをmassFactorとballGraphicにしてそれぞれ登録する。drawはballGraphicを当てはめる形。
class Ball{
	constructor(x, y, ballGraphic, sizeFactor = 1.0){
		this.type = "default";
		this.position = createVector(x, y);
		this.velocity = createVector(0, 0);
		this.radius = BALL_RADIUS * sizeFactor; // sizeFactorだけ大きくなる。MAXで2.5の予定。
		this.friction = FRICTION_COEFFICIENT;
		this.massFactor = 1.0; // デフォルト1.0で統一。特別なクラスの場合に上書きする。
		this.graphic = ballGraphic;
		this.alive = true; // aliveがfalseになったら排除する。
	}
	setVelocityCartesian(vx, vy){
		// デカルト座標系
		this.velocity.set(vx, vy);
	}
	setVelocity(speed, direction){
		// 極座標系
		this.velocity.set(speed * cos(direction), speed * sin(direction));
	}
	applyReflection(){
		// 反射処理。
		// positionAdjustmentは_ball, d, nにしたよ。だから、こうする。
		if(this.position.x < this.radius || this.position.x > AREA_WIDTH - this.radius){
		  const normalVectorWithWallX = createVector(1, 0);
			const distanceWithWall = (this.position.x < this.radius ? this.position.x : AREA_WIDTH - this.position.x);
			positionAdjustment(this, distanceWithWall, normalVectorWithWallX);
			this.velocity = reflection(this.velocity, normalVectorWithWallX);
		}else if(this.position.y < this.radius || this.position.y > AREA_HEIGHT - this.radius){
			const normalVectorWithWallY = createVector(0, 1);
			const distanceWithWall = (this.position.y < this.radius ? this.position.y : AREA_HEIGHT - this.position.y);
			positionAdjustment(this, distanceWithWall, normalVectorWithWallY);
			this.velocity = reflection(this.velocity, normalVectorWithWallY);
		}
	}
	applyFriction(){
		// 摩擦を与える
		this.velocity.mult(1 - this.friction);
	}
	kill(){
		this.alive = false;
		// 強制的に殺す。・・これ使えばdeleteのところにあれこれ書く必要ないな・・。最後のremoveObjectsで消せるやん。
	}
	reaction(_system, _other){ /* 衝突した際の反応（reaction） */ }
	update(){
		this.position.add(this.velocity);
		this.applyReflection();
		this.applyFriction();
		if(this.velocity.mag() < SPEED_LOWER_LIMIT){ this.velocity.set(0, 0); } // 速さの下限に達したら0にする。
	}
	draw(){
		// 240x240の元画像を拡縮
		image(this.graphic, this.position.x - this.radius * 1.2, this.position.y - this.radius * 1.2,
		                    this.radius * 2.4, this.radius * 2.4,
											  0, 0, ORIGIN_BALL_RADIUS * 2.4, ORIGIN_BALL_RADIUS * 2.4);
	}
}

// 同じ色のカラーボールに衝突した後、動きが止まると消える。
class ColorBall extends Ball{
	constructor(x, y, ballGraphic, sizeFactor, paleGraphic, colorId){
		super(x, y, ballGraphic, sizeFactor);
		this.type = "color";
		this.paleGraphic = paleGraphic;
		this.colorId = colorId;
		this.pale = false;
	}
	reaction(_system, _other){
		// カラー同士の場合、色が同じなら発光する。おわり。
		if(_other.type === "color" && _other.colorId === this.colorId){
			this.pale = true; this.graphic = this.paleGraphic;
		}
	}
	update(){
		super.update();
		if(this.pale && this.velocity.mag() === 0){ this.kill(); }
		// lifeは廃止。aliveプロパティを使う。
	}
}

// 相手が発光しているときに衝突すると自身も発光する。それだけ。
// あと今気付いたけど動きが止まると消えるみたい。
// Thunderとかは発光しないで消滅するから不要よね。
class IceBall extends Ball{
	constructor(x, y, ballGraphic, sizeFactor, paleGraphic){
		super(x, y, ballGraphic, sizeFactor);
		this.type = "ice";
		this.paleGraphic = paleGraphic;
		this.pale = false;
	}
	reaction(_system, _other){
		// 相手が発光していれば発光する。発光しないサンダーとかは変化なし。
		if((_other.type === "color" || _other.type === "ice") && _other.pale){
			this.pale = true; this.graphic = this.paleGraphic;
		}
	}
	update(){
		super.update();
		if(this.pale && this.velocity.mag() === 0){ this.kill(); }
		// lifeが0になったら排除。
	}
}

// サンダーボールはカラーと当たるとそれと同じ色のカラーをすべて消して自分も消える。
class ThunderBall extends Ball{
	constructor(x, y, ballGraphic, sizeFactor){
		super(x, y, ballGraphic, sizeFactor);
		this.type = "thunder";
	}
	reaction(_system, _other){
		if(_other.type === "color"){
			for(let _ball of _system.balls){
				if(_ball.type === "color" && _ball.colorId === _other.colorId){ _ball.kill(); }
			}
			this.kill();
		}
	}
}

// ヘビーボールはmassFactorが2.0で摩擦係数が1.5倍の0.3になってる。
// 消滅しない。残る。
class HeavyBall extends Ball{
	constructor(x, y, ballGraphic, sizeFactor){
		super(x, y, ballGraphic, sizeFactor);
		this.type = "heavy";
		this.massFactor = 2.0;
		this.friction = FRICTION_COEFFICIENT * 1.5;
	}
}

// マジカルボール、ボツ（面白くない）

// ライトアークボール、レフトアークボールはおいおい。進行方向がカーブする感じ・・

// グラフィックはボールによってはいじるかもだけどそこらへんは個別に対応できるし上書きできるからOK.

// 手玉は継承で書く・・？衝突時のアクションが皆無だからBallでいいかも。
// 穴に落ちて消えるにしてもそれを書くのはここじゃないでしょう。

// -------------------------------------------------------------------------------------------------------------------- //
// System.

class System{
  constructor(){
		// 背景
		this.boardId = 0;
		this.boardGraphic = createBoardGraphic(); // 背景工夫したいねって
		// ボール
    this.balls = [];
		// ボール動かす用
		this.shooter = new BallShooter();
		// ボールの種類関連
		this.ballKindId = 0;
		this.ballSizeFactor = 1.0; // サイズ変えてみたい
    this.createBallGraphics();
		// ボールのサイズ調整用
    this.createSizeChangeSlider();
		// コンフィグ関連
		this.modeId = 0;
		this.configGraphic = createConfigGraphic();  // コンフィグエリアのグラフィック
	  this.createButtons();
		// パーティクル関連
		this.particles = new ParticleSystem();
  }
	getModeId(){
		return this.modeId;
	}
	createBallGraphics(){
		// ボール画像. normalとpaleの2種類。
		this.ballGraphic = {};
		this.ballGraphic.normal = [];
		this.ballGraphic.pale = [];
		// とりあえず現時点ではnormal8つとpale8つかな。iceBallにもpaleあるし。つまり9つまで。normalは12個までって感じかな。
		for(let i = 0; i < 8; i++){
			this.ballGraphic.normal.push(createColorBallGraphic(i));
			this.ballGraphic.pale.push(createColorBallGraphic(i, 0.7)); // 0.7はpaleRatioでこれにより薄くなる感じ。
		}
		// アイスボールのグラフィック(8)
		this.ballGraphic.normal.push(createIceBallGraphic());
		this.ballGraphic.pale.push(createIceBallGraphic(0.5));
		// サンダーボールのグラフィック(9)
		this.ballGraphic.normal.push(createThunderBallGraphic());
		this.ballGraphic.pale.push(createThunderBallGraphic(0.5));
		// ヘビーボールのグラフィック(10)
		this.ballGraphic.normal.push(createHeavyBallGraphic());
		this.ballGraphic.pale.push(createHeavyBallGraphic(0.5));
		// 8, 9, 10, 11は今後・・
		// このあと種類を増やすことを考えると、colorIdよりballKindIdとした方が意味的にいいと思う。
		// で、0～7をColorBall生成時の色のidとして採用すればいい。
	}
	createSizeChangeSlider(){
		// サイズ変更用のカーソルとスライダーを作る。
		const w = CONFIG_WIDTH;
		const h = AREA_HEIGHT;
    const sizeChangeCursor = new Cursor("circle", {r:w * 0.05}, 1.1, color(64));
		this.sizeChangeSlider = new LineSlider(1.0, 2.5, sizeChangeCursor, createVector(w * 0.05, h * 0.225), createVector(w * 0.95, h * 0.225));
		// 初期化時にコンフィグエリアの左上の座標をわたす。
		this.sizeChangeSlider.initialize(AREA_WIDTH, 0);
	}
	createButtons(){
		const w = CONFIG_WIDTH;
		const h = AREA_HEIGHT;
		const r = BALL_RADIUS;
		// コンフィグボードの位置
		const offSetX = AREA_WIDTH;
		const offSetY = 0;
    // 背景選択用ボタン
		this.boardButtons = new UniqueButtonSet();
		const atv = this.boardGraphic.active;
		const inAtv = this.boardGraphic.inActive;
		const boardButtonWidth = w * 0.164;
		const boardButtonHeight = h * 0.08;
		this.boardButtons.addNormalButton(w * 0.03, h * 0.26, boardButtonWidth, boardButtonHeight, atv[0], inAtv[0]);
		this.boardButtons.addNormalButton(w * 0.224, h * 0.26, boardButtonWidth, boardButtonHeight, atv[1], inAtv[1]);
		this.boardButtons.addNormalButton(w * 0.438, h * 0.26, boardButtonWidth, boardButtonHeight, atv[2], inAtv[2]);
		this.boardButtons.addNormalButton(w * 0.632, h * 0.26, boardButtonWidth, boardButtonHeight, atv[3], inAtv[3]);
		this.boardButtons.addNormalButton(w * 0.826, h * 0.26, boardButtonWidth, boardButtonHeight, atv[4], inAtv[4]);
		this.boardButtons.initialize(offSetX, offSetY);
    // ボールの種類を選択する為のボタン
		// ballButtonsに改名。
		let buttonColor = [];
		for(let i = 0; i < COLOR_PALETTE.length; i++){ buttonColor.push(color(COLOR_PALETTE[i])); }
		this.ballButtons = new UniqueButtonSet();
		const ballButtonWidth = w * 0.225;
		const ballButtonHeight = h * 0.09;
		this.ballButtons.addColorButton(w * 0.02, h * 0.505, ballButtonWidth, ballButtonHeight, buttonColor[0]);
		this.ballButtons.addColorButton(w * 0.265, h * 0.505, ballButtonWidth, ballButtonHeight, buttonColor[1]);
		this.ballButtons.addColorButton(w * 0.51, h * 0.505, ballButtonWidth, ballButtonHeight, buttonColor[2]);
		this.ballButtons.addColorButton(w * 0.755, h * 0.505, ballButtonWidth, ballButtonHeight, buttonColor[3]);
		this.ballButtons.addColorButton(w * 0.02, h * 0.605, ballButtonWidth, ballButtonHeight, buttonColor[4]);
		this.ballButtons.addColorButton(w * 0.265, h * 0.605, ballButtonWidth, ballButtonHeight, buttonColor[5]);
		this.ballButtons.addColorButton(w * 0.51, h * 0.605, ballButtonWidth, ballButtonHeight, buttonColor[6]);
		this.ballButtons.addColorButton(w * 0.755, h * 0.605, ballButtonWidth, ballButtonHeight, buttonColor[7]);
		//const specialBallCreateFunctionArray = [createIceBallGraphic, createThunderBallGraphic, createHeavyBallGraphic, createMagicalBallGraphic];
		// ごちゃごちゃしててわけわからんー
		//const specialBallCreateFunctionArray = [createIceBallGraphic, createThunderBallGraphic];
		let activeButtonGraphicArray = [];
		let nonActiveButtonGraphicArray = [];
		for(let i = 8; i <= 10; i++){
			activeButtonGraphicArray.push(createSpecialBallButtonGraphic(ballButtonWidth, ballButtonHeight, this.ballGraphic.normal[i]));
			nonActiveButtonGraphicArray.push(createSpecialBallButtonGraphic(ballButtonWidth, ballButtonHeight, this.ballGraphic.pale[i], 0.5));
		}
		this.ballButtons.addNormalButton(w * 0.02, h * 0.705, ballButtonWidth, ballButtonHeight,
			                               activeButtonGraphicArray[0], nonActiveButtonGraphicArray[0]);
		this.ballButtons.addNormalButton(w * 0.265, h * 0.705, ballButtonWidth, ballButtonHeight,
			                               activeButtonGraphicArray[1], nonActiveButtonGraphicArray[1]);
		this.ballButtons.addNormalButton(w * 0.51, h * 0.705, ballButtonWidth, ballButtonHeight,
																 		 activeButtonGraphicArray[2], nonActiveButtonGraphicArray[2]);
		this.ballButtons.initialize(offSetX, offSetY);
    // モードを変更する為のボタン
		this.modeButtons = new UniqueButtonSet();
		const modeButtonWidth = w * 0.3;
		const modeButtonHeight = h * 0.08;
		this.modeButtons.addColorButton(w * 0.025, h * 0.9, modeButtonWidth, modeButtonHeight, buttonColor[8], "ADD");
		this.modeButtons.addColorButton(w * 0.35, h * 0.9, modeButtonWidth, modeButtonHeight, buttonColor[8], "MOV");
		this.modeButtons.addColorButton(w * 0.675, h * 0.9, modeButtonWidth, modeButtonHeight, buttonColor[8], "DEL");
		this.modeButtons.initialize(offSetX, offSetY);
	}
	activateButton(){
		// 他の種類のボタンもできるようにボタンをまとめたクラスを用意すべきかもね。
    //const x = mouseX - AREA_WIDTH;
		//const y = mouseY;
		if(mouseX < CONFIG_WIDTH || mouseX > width || mouseY < 0 || mouseY > AREA_HEIGHT){ return; }
    // 一旦activeになってるところをinActivateしたうえで、必要なら更新して、それからactivateする。
		this.boardButtons.activate();
		this.boardId = this.boardButtons.getActiveButtonId();
		this.modeButtons.activate();
		this.modeId = this.modeButtons.getActiveButtonId();
		this.ballButtons.activate();
		this.ballKindId = this.ballButtons.getActiveButtonId();
	}
	activateSlider(){
		this.sizeChangeSlider.activate();
	}
	inActivateSlider(){
		this.sizeChangeSlider.inActivate();
	}
	addBallCheck(x, y){
		// ある程度のマージンを持たせて密着しないようにする。
		// 最初に個数の確認
		if(this.balls.length > BALL_CAPACITY){ return false; }

		// 先に新しいボールの半径を計算しちゃう。
		const newBallRadius = this.ballSizeFactor * BALL_RADIUS;

		// 個々のボールと位置が被らないかどうか
    for(let b of this.balls){
			if(dist(b.position.x, b.position.y, x, y) < b.radius + newBallRadius + BALL_APPEAR_MARGIN){ return false; }
		}

		// 壁にめり込まないかどうか。
		if(x < newBallRadius + BALL_APPEAR_MARGIN || x > AREA_WIDTH - newBallRadius - BALL_APPEAR_MARGIN){ return false; }
		if(y < newBallRadius + BALL_APPEAR_MARGIN || y > AREA_HEIGHT - newBallRadius - BALL_APPEAR_MARGIN){ return false; }

		// もろもろ潜り抜けたらOK.
		return true;
	}
  addBall(x, y){
    const pos = {x, y};
    // Ballを追加する
		if(this.ballKindId < 8){
      this.addColorBall(pos, this.ballKindId);
		}
		switch(this.ballKindId){
			case 8:
        this.addIceBall(pos);
				break;
			case 9:
        this.addThunderBall(pos);
				break;
			case 10:
        this.addHeavyBall(pos);
				break;
		}
  }
  addColorBall(pos, colorId){
    console.log(pos);
    const normalGraphic = this.ballGraphic.normal[colorId];
    const paleGraphic = this.ballGraphic.pale[colorId];
    this.balls.push(new ColorBall(pos.x, pos.y, normalGraphic, this.ballSizeFactor, paleGraphic, colorId));
    return this;
  }
  addIceBall(pos){
    const normalGraphic = this.ballGraphic.normal[8];
    const paleGraphic = this.ballGraphic.pale[8];
    this.balls.push(new IceBall(pos.x, pos.y, normalGraphic, this.ballSizeFactor, paleGraphic));
    return this;
  }
  addThunderBall(pos){
    const normalGraphic = this.ballGraphic.normal[9];
    this.balls.push(new ThunderBall(pos.x, pos.y, normalGraphic, this.ballSizeFactor));
    return this;
  }
  addHeavyBall(pos){
    const normalGraphic = this.ballGraphic.normal[10];
    this.balls.push(new HeavyBall(pos.x, pos.y, normalGraphic, this.ballSizeFactor));
    return this;
  }
  setStage(stageId){
    // すべてのボールをクリアしてから、指定された配置でボールを用意する
    this.clearBall();
    window["createStage" + stageId.toString()](this);
  }
  clearBall(){
    // すべてのボールを排除する
    for(let b of this.balls){ b.kill(); }
  }
  findBall(x, y){
    // Ballが(x, y)にあるかどうか調べてあればそのボールを返すがなければundefinedを返す。
    for(let i = 0; i < this.balls.length; i++){
      const _ball = this.balls[i];
      if(dist(_ball.position.x, _ball.position.y, x, y) < _ball.radius){ return _ball; }
    }
    return undefined;
  }
	setShootingBall(_ball){
		// id番のボールをセットする。
		this.shooter.setTarget(_ball);
	}
	shootBall(){
		// セットしたボールを離す。
		this.shooter.shoot();
		// ボールが動くかどうかにかかわらずリリースする。
		this.shooter.release();
	}
	deleteBall(_ball){
    // Ballを削除する
		// lifeどうのではなく、直接排除するので、パーティクルの実験にもってこい。
		// idでなくball自体を渡すべき？か・・排除は最後にやるし。ここではkillするだけでいいね。
		_ball.kill();
  }
	createParticleAtRemove(_ball){
		// ボールを排除するときのparticle出力
		const {x, y} = _ball.position;
		this.particles.setSizeFactor(_ball.radius / BALL_RADIUS); // 半径に応じて大きさを変える
		this.particles.setHop(true);
		switch(_ball.type){
			case "color":
			  this.particles.createParticle(x, y, color(COLOR_PALETTE[_ball.colorId]), drawStar, 20);
				break;
			case "ice":
			  this.particles.createParticle(x, y, color(COLOR_PALETTE[9]), drawCross, 20);
				break;
			case "thunder":
				this.particles.createParticle(x, y, color(COLOR_PALETTE[10]), drawCross, 20);
				break;
			case "heavy":
				this.particles.createParticle(x, y, color(COLOR_PALETTE[11]), drawCross, 20);
				break;
		}
	}
	createParticleAtCollide(_ball, collidePoint){
		// ボールが衝突するときのparticle出力
		// 発生ポイントを衝突時の接点にしたいのでそこだけ修正。
		//const {x, y} = _ball.position;
		const {x, y} = collidePoint;
		this.particles.setSizeFactor(_ball.radius * 0.5 / BALL_RADIUS); // リムーブ時の半分
		this.particles.setHop(true);
		switch(_ball.type){
			case "color":
			  this.particles.createParticle(x, y, color(COLOR_PALETTE[_ball.colorId]), drawTriangle, 5);
				break;
			case "ice":
			  this.particles.createParticle(x, y, color(COLOR_PALETTE[9]), drawTriangle, 5);
				break;
			case "thunder":
				this.particles.createParticle(x, y, color(COLOR_PALETTE[10]), drawTriangle, 5);
				break;
			case "heavy":
				this.particles.createParticle(x, y, color(COLOR_PALETTE[11]), drawTriangle, 5);
				break;
		}
	}
  update(){
		this.sizeChangeSlider.update();
		this.ballSizeFactor = this.sizeChangeSlider.getValue();
    for(let b of this.balls){ b.update(); }
		this.particles.update(); // particleのupdate.
  }
  applyCollide(){
    for(let ballId = 0; ballId < this.balls.length; ballId++){
  		const _ball = this.balls[ballId];
  		for(let otherId = ballId + 1; otherId < this.balls.length; otherId++){
  			const _other = this.balls[otherId];
        // 消えたボールは無視
				if(!_ball.alive || !_other.alive){ continue; }
        // ぶつからなければ無視
  			if(!collisionCheck(_ball, _other)){ continue; }
        // 双方のスピードが遅すぎるときは無視（これやらないとぶつかってないのにパーティクル出ちゃう）
      	if(_ball.velocity.mag() < SPEED_LOWER_LIMIT && _other.velocity.mag() < SPEED_LOWER_LIMIT){ continue; }
        // 衝突処理
  			perfectCollision(_ball, _other);
				// この時接しているので接点作るのは簡単。
				const radiusRatio = _ball.radius / (_ball.radius + _other.radius);
				const collidePoint = {};
				collidePoint.x = _ball.position.x * (1 - radiusRatio) + _other.position.x * radiusRatio;
				collidePoint.y = _ball.position.y * (1 - radiusRatio) + _other.position.y * radiusRatio;
        // 衝突時のパーティクルを生成する
				this.createParticleAtCollide(_ball, collidePoint);
				this.createParticleAtCollide(_other, collidePoint);
				_ball.reaction(this, _other);
				_other.reaction(this, _ball);
  		}
  	}
  }
  applyGutter(){
		for(let b of this.balls){
			if(b.position.y < AREA_HEIGHT * GUTTER_PROPORTION || b.position.y > AREA_HEIGHT * (1 - GUTTER_PROPORTION)){ b.kill(); }
		}
	}
  draw(){
		// 背景描画
		image(this.boardGraphic.active[this.boardId], 0, 0);
    // ガター描画
		fill(0);
		rect(0, 0, AREA_WIDTH, AREA_HEIGHT * GUTTER_PROPORTION);
		rect(0, AREA_HEIGHT * (1 - GUTTER_PROPORTION), AREA_WIDTH, AREA_HEIGHT);
    // ボール描画
    for(let b of this.balls){ b.draw(); }
		this.particles.draw(); // particleのdraw.
    this.shooter.draw(); // うまくいくか
    this.drawConfig();
  }
  drawConfig(){
		// ここでconfigGraphicをいじる、というかここは毎フレーム描く。
		let gr = this.configGraphic;
		gr.background(70);
		const w = CONFIG_WIDTH;
		const h = AREA_HEIGHT;
		// 先にボールサイズ用のエリア(h * 0.0～h * 2.5のところ)
		// 最初にw * 0.3, h * 1.0のところに出現させるボールを表示する。
		gr.image(this.ballGraphic.normal[this.ballKindId],
			       w * 0.5 - BALL_RADIUS * this.ballSizeFactor * 1.2, h * 0.1 - BALL_RADIUS * this.ballSizeFactor * 1.2,
						 BALL_RADIUS * this.ballSizeFactor * 2.4, BALL_RADIUS * this.ballSizeFactor * 2.4,
					   0, 0, ORIGIN_BALL_RADIUS * 2.4, ORIGIN_BALL_RADIUS * 2.4);
		// スライダーの描画。
    this.sizeChangeSlider.draw(gr);
		// 全部同じ色でいいよ。茶色かなんかで。で、違うときは暗くする。
		// これでいいんだけど、今まで通りのこの方法だとマウスクリックとの紐付けが非常に面倒なので、何とかしたいです。
		// ボタンをクラス化しました～
		this.boardButtons.draw(gr);
		this.modeButtons.draw(gr);
		this.ballButtons.draw(gr);
		image(this.configGraphic, AREA_WIDTH, 0);
  }
	removeObjects(){
		// killされたボールの排除やパーティクルの排除などを行う。
		for(let i = this.balls.length - 1; i >= 0; i--){
			const _ball = this.balls[i];
			if(!_ball.alive){
				this.balls.splice(i, 1);
				this.createParticleAtRemove(_ball);
			}
		}
		this.particles.remove();
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
    this.normalX = createVector(1, 0);
    this.normalY = createVector(0, 1);
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
		// なんか式が変だったから修正した・・。
		//return min(dist(this.target.position.x, this.target.position.y, mouseX, mouseY), ARROWLENGTH_LIMIT + BALL_RADIUS) - BALL_RADIUS;
		return min(dist(this.target.position.x, this.target.position.y, mouseX, mouseY) - this.target.radius, ARROWLENGTH_LIMIT);
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
	drawArrow(arrowLength, direction){
    // 矢印の長さと方向を送る
		let start = createVector(this.target.radius * cos(direction), this.target.radius * sin(direction));
		let end = createVector((this.target.radius + arrowLength) * cos(direction), (this.target.radius + arrowLength) * sin(direction));
		start.add(this.target.position);
		end.add(this.target.position);
		stroke(lerpColor(color(63, 72, 204), color(237, 28, 36), arrowLength / ARROWLENGTH_LIMIT));
		//stroke(55 + 45 * (arrowLength / ARROWLENGTH_LIMIT), 100, 100);
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
  drawOrbit(arrowLength, direction){
    // 軌道直線を、書けたら、書きたい。
    let p = this.target.position.copy();
		const speed = arrowLength * SPEED_UPPER_LIMIT / ARROWLENGTH_LIMIT;
    let v = createVector(speed * cos(direction), speed * sin(direction));
    const r = this.target.radius;
    const f = this.target.friction;
    // pにvを足していって壁につくたびに反射させてvには摩擦を適用し続けて壁にぶつかったところと止まったところの
    // 点を集めて順繰りに線でつなぐだけ。
    let pointArray = [];
    pointArray.push({x:p.x, y:p.y});
    while(v.mag() >= SPEED_LOWER_LIMIT){
      p.add(v);
      if(p.x < r || p.x > AREA_WIDTH - r){
        const distanceWithWallX = (p.x < r ? p.x : AREA_WIDTH - p.x);
      	p.sub(p5.Vector.mult(v, (r - distanceWithWallX) / abs(v.x)));
        v.x *= -1;
        pointArray.push({x:p.x, y:p.y});
      }
      if(p.y < r || p.y > AREA_HEIGHT - r){
        const distanceWithWallY = (p.y < r ? p.y : AREA_HEIGHT - p.y);
        p.sub(p5.Vector.mult(v, (r - distanceWithWallY) / abs(v.y)));
        v.y *= -1;
        pointArray.push({x:p.x, y:p.y});
      }
      v.mult(1 - f);
    }
    pointArray.push({x:p.x, y:p.y});
    stroke(181, 230, 29);
    strokeWeight(4.0);
    for(let i = 0; i < pointArray.length - 1; i++){
      line(pointArray[i].x, pointArray[i].y, pointArray[i + 1].x, pointArray[i + 1].y);
    }
    noStroke();
    fill(255, 128);
    circle(p.x, p.y, r * 2);
  }
  draw(){
    if(!this.active){ return; }
    const arrowLength = this.getArrowLength();
    if(arrowLength <= 0){ return; }
		const direction = atan2(mouseY - this.target.position.y, mouseX - this.target.position.x);
    this.drawOrbit(arrowLength, direction);
    this.drawArrow(arrowLength, direction);
  }
}

// -------------------------------------------------------------------------------------------------------------------- //
// Functions for collide.
// 衝突関連の関数群。衝突判定や、反射時の速度計算、およびそれに基づくボール同士が衝突したときの速度計算など。
// ボール同士の衝突は、まずそれぞれの速度から重心座標を割り出してそれに対する相対速度を抜き出し、
// めり込みを計算して互いに接しているところまでそれらの相対速度に従ってボールを後退させ、
// そのうえで新しくできた接触面に対して完全弾性衝突による反射を行い新たな速度とする。
// もし反発係数を加味するのならここの部分で衝突面に垂直な速度成分を抜き出しそのうちの何%かの長さのベクトルで速度を引いてやる処理が必要。
// 壁との反射も同様。

// 半径を見て衝突判定。これは半径が異なっても普通に使える。
function collisionCheck(_ball, _other){
  return p5.Vector.dist(_ball.position, _other.position) < _ball.radius + _other.radius;
}

// まずball.massFactorとball.velocityとotherのそれから重心のベクトルを出してそれを使って相対速度を作って
// それに対して衝突面の法線ベクトル、これはpositionのsubを取るだけ。これで相対速度を反射させる。
// 最後に重心ベクトルを足しなおせば完成（のはず）

// distanceWithWallの計算で中心間の距離を2で割ってるけどここ半径が異なる場合には違う、円の交点を結ぶ直線がそれだと出ないので。
// まあ大して複雑な計算じゃないけど。
// あれ・・計算違う気がしてきたな・・相対速度の比が質量比だから・・これまずいなぁ。んー・・
// 戻る距離が速度に比例するでしょ、軽い方がたくさん戻るから、これまずいねって。
// 壁の場合と違って移動距離の合計を質量のファクターで分配するから、同じメソッドは使えなさそう。
function perfectCollision(_ball, _other){
	// ballとotherが衝突したときの速度の変化を記述する（面倒なので完全弾性衝突で）
	// 重心ベクトル
	const g = getCenterVector(_ball, _other);
	// 相対速度
	let u = p5.Vector.sub(_ball.velocity, g);
	let v = p5.Vector.sub(_other.velocity, g);

  // ここまでOK.
	// collisionPlaneNormalVectorの名称はやめて、fromOtherToBallとでもする（_otherから_ballへ）
	// uとfromOtherToBallのなす角のcosと、fromOtherToBallの長さ(intiialDistance)と両者の半径の和(radiusSum)から
	// 移動距離の総和(l=adjustDistanceSum)が出る、それを質量比で割って、それぞれの移動距離を出してu,vと同じ方向のベクトルでそういう大きさの
	// 物を作ってsubすればOK.

	const fromOtherToBall = p5.Vector.sub(_ball.position, _other.position);
	const initialDistance = fromOtherToBall.mag();
	const c = p5.Vector.dot(u, fromOtherToBall) / (u.mag() * initialDistance);
	const radiusSum = _ball.radius + _other.radius;

	const adjustDistanceSum = initialDistance * c + sqrt(radiusSum * radiusSum - initialDistance * initialDistance * (1 - c * c));
	const adjustDistanceForBall = adjustDistanceSum * _other.massFactor / (_ball.massFactor + _other.massFactor);
	const adjustDistanceForOther = adjustDistanceSum * _ball.massFactor / (_ball.massFactor + _other.massFactor);
	_ball.position.sub(p5.Vector.mult(u, adjustDistanceForBall / u.mag()));
	_other.position.sub(p5.Vector.mult(v, adjustDistanceForOther / v.mag()));

	// 位置が変わったあとは同じように接触面のベクトルで反射処理するだけ。
  const newNormalVector = p5.Vector.sub(_ball.position, _other.position);
	u = reflection(u, newNormalVector);
	v = reflection(v, newNormalVector);
	_ball.velocity = p5.Vector.add(u, g);
	_other.velocity = p5.Vector.add(v, g);
	collideSound.play();
}

// 重心座標を得るために重心ベクトルを計算する
function getCenterVector(_ball, _other){
  const multiplier = 1 / (_ball.massFactor + _other.massFactor);
	const u = p5.Vector.mult(_ball.velocity, _ball.massFactor);
	const v = p5.Vector.mult(_other.velocity, _other.massFactor);
	return p5.Vector.mult(p5.Vector.add(u, v), multiplier);
}

// どうもね、衝突の場合は重心座標系でやらないとだめっぽいね。
// 当たり前といえば当たり前だ・・だって重心座標系にしたから壁の反射で計算できてるんでしょ。
// だからそれ相応の速度を使わないとね・・。

// もうこれは壁との反射でしか使わないので、普通にp, v, adjDist(radius)のところは_ball送っちゃっていいよ。
// だから初期の壁との距離d, 結局_ballとdとnだけでいいね。nは壁に向かう方向でよろしく。
// 壁に向かってる以上は必然的にcosは正になるけれど・・
// だめ。absしないと。でないとたとえば右端と左端で違うベクトルが必要になってしまう。面倒くさい。同じ(1, 0)や(0, 1)を使いたい。

function positionAdjustment(_ball, distanceWithWall, normalVectorWithWall){
  // distanceWithWall:衝突時の壁との距離。normalVectorWithWall:壁に垂直なベクトル（向きは自由）。
	const multiplier = (_ball.radius - distanceWithWall) * normalVectorWithWall.mag() / abs(p5.Vector.dot(_ball.velocity, normalVectorWithWall));
	_ball.position.sub(p5.Vector.mult(_ball.velocity, multiplier));
}

// だから、このadjustmentも、戻る距離の総和を出したうえで、それを質量比で割って、それの分だけ戻さないと・・ねぇ。

// 接触面が確定したら普通に反射処理を行う。
function reflection(v, n){
	// nは壁の法線ベクトル(normalVector)。これにより反射させる。
	// nとして、v→v - 2(v・n)nという計算を行う。
	// nが単位ベクトルでもいいように大きさの2乗（n・n）で割るか・・（collisionでも使うので）
	return p5.Vector.sub(v, p5.Vector.mult(p5.Vector.mult(n, 2), p5.Vector.dot(v, n) / p5.Vector.dot(n, n)));
}
// 反発についてはこの「2」を「1 + restitution」にする。FALさんのあれに出てきた。restitution coefficient（反発係数）だ。
// 1で完全弾性衝突（今の場合）。1より小さくすれば反発で垂直方向の速度は削られる。たとえば0.95とかにするとかね。
// ボール同士でも同じメソッドを使うから一緒だけどまあない方が軌道予測しやすいからいいかもね・・んー。
// 逆に1.05とかにすればぼよ～んってなるから面白いよね。
// 動かないボールとか用意して当たるとぼよ～んしちゃうとか？ボールにfixプロパティを設けてfixがあると・・
// fixはmassFactor=infinityとして実現できる。比でしか使われてないから、つまりそういうこと。

// 片方が固定の場合のperfectCollisionについて考えていた。
// gが_ballと_otherのうちfixedでない方になるのでuかvは0になるわけだね。gの計算でfixedを考慮した場合分けしないと。
// fixed同士はぶつかりようがないからそこはいい。
// お邪魔ブロックってフリーランに出てくるからね・・それを実装したいっていう。
// cの計算がまずい。uとvのうち0でないほうを取らなければならない。
// radiusSumからinitialDistanceだけ引いた分、fixedでない方を戻せばいいので複雑な計算は要らない。あとは一緒。要するにボールを壁だと思って反射するだけ。

// 反射の仕様変更について。
// 壁との反射は(r-d)/「ボールの速度および壁に向かうベクトルのなす角のcos」でいいよ。
// ボール同士の衝突は例の計算でいいと思う。

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

// ボール画像作り直し。paleRatioは0.0がデフォで1.0に近づくと白くなる。
// HSBやめたから普通にlerpColorで作る。
function createColorBallGraphic(colorId, paleRatio = 0.0){
  const r = ORIGIN_BALL_RADIUS;

	let gr = createGraphics(r * 2.4, r * 2.4);
	gr.noStroke();
	gr.translate(r * 1.2, r * 1.2);

	const ballColor = color(COLOR_PALETTE[colorId]);
	// 中心が白くなるグラデーションをかける。
	for(let i = 0; i < 100; i++){
		const prg = 0.5 * (1 - cos(PI * (i / 100)));
		gr.fill(lerpColor(ballColor, color(255), paleRatio + (1 - paleRatio) * prg));
		gr.circle(0, 0, 2 * r * (1 - i / 100));
	}

	return gr;
}

// アイスボール作ろうぜ
function createIceBallGraphic(paleRatio = 0.0){
	// まずradiusの20%まで外側から水色→白のグラデーションで30分割くらいで円弧を描く（noFill）
	// ベースは薄い水色で。
	// 最後に濃い水色のダイヤを30°ずつ回転させて6つ描く感じ。中心に半径の20%の円を描いてその上を点が動く感じ。
  const r = ORIGIN_BALL_RADIUS;

  let gr = createGraphics(r * 2.4, r * 2.4);
	gr.noStroke();
	gr.translate(r * 1.2, r * 1.2);

	// baseColor.水色系。
	const baseColor = lerpColor(color(0, 162, 232), color(255), paleRatio);
	gr.fill(lerpColor(baseColor, color(255), 0.4));
	gr.circle(0, 0, r * 2);
	gr.noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		gr.stroke(lerpColor(baseColor, color(255), prg));
		gr.strokeWeight(r * 0.4 / 30);
		gr.arc(0, 0, r * (2 - 0.8 * prg), r * (2 - 0.8 * prg), 0, 2 * PI);
	}
	gr.noStroke();
	let p = [];
	for(let k = 0; k < 12; k++){
		p.push({x:r * 0.9 * cos(PI * k / 6), y:r * 0.9 * sin(PI * k / 6)});
	}
	for(let k = 0; k < 12; k++){
		// PI/2足すことで記述を簡潔にする。
		p.push({x:r * 0.1 * cos(PI * k / 6 + PI / 2), y:r * 0.1 * sin(PI * k / 6 + PI / 2)});
	}
	gr.fill(baseColor);
	for(let k = 0; k < 6; k++){
		gr.quad(p[k].x, p[k].y, p[k + 12].x, p[k + 12].y, p[k + 6].x, p[k + 6].y, p[k + 18].x, p[k + 18].y);
	}

	return gr;
}

// サンダーボール作るよ
function createThunderBallGraphic(paleRatio = 0.0){
	// オレンジ系、中央に稲妻。
	// オレンジ、中央に稲妻。
  const r = ORIGIN_BALL_RADIUS;

	let gr = createGraphics(r * 2.4, r * 2.4);
  gr.noStroke();
	gr.translate(r * 1.2, r * 1.2);

	const baseColor = lerpColor(color(255, 144, 0), color(255), paleRatio);
	gr.fill(lerpColor(baseColor, color(255), 0.4));
	gr.circle(0, 0, r * 2);
	gr.noFill();
	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		gr.stroke(lerpColor(baseColor, color(255), prg));
		gr.strokeWeight(r * 0.4 / 30);
		gr.arc(0, 0, r * (2 - 0.8 * prg), r * (2 - 0.8 * prg), 0, 2 * PI);
	}
	gr.noStroke();
	// 稲妻を二つの三角形で表現。
	gr.fill(baseColor);
	gr.triangle(-r * 0.1, 0, -r * 0.2, r * 0.8, r * 0.4, 0);
	gr.triangle(r * 0.1, 0, r * 0.2, -r * 0.8, -r * 0.4, 0);

	return gr;
}

// ヘビーボール。
function createHeavyBallGraphic(paleRatio = 0.0){
	// 月形を逆にした感じ
	const r = ORIGIN_BALL_RADIUS;

	let gr = createGraphics(r * 2.4, r * 2.4);
	gr.noStroke();
  gr.translate(r * 1.2, r * 1.2);

	const baseColor = lerpColor(color(64), color(255), paleRatio);
	gr.fill(lerpColor(baseColor, color(255), 0.4));
	gr.circle(0, 0, r * 2);
	gr.noFill();

	for(let i = 0; i < 30; i++){
		let prg = i / 30;
		prg = pow(prg, 2);
		gr.stroke(lerpColor(baseColor, color(255), prg));
		gr.strokeWeight(r * 0.4 / 30);
		gr.arc(0, 0, r * (2 - 0.8 * prg), r * (2 - 0.8 * prg), 0, 2 * PI);
	}

	gr.noStroke();
	// まず円を描いてちょっと上に同じ大きさの円をlerpedBaseColorで描く
	gr.fill(baseColor);
	gr.circle(0, 0, r * 0.8);
	gr.fill(lerpColor(baseColor, color(255), 0.4));
	gr.circle(0, -r * 0.2, r * 0.6);

	return gr;
}

// ボタン画像作る。色用と、それ以外。モード選択には別の色を使うつもり。黄緑系とかその辺。
// ColorButtonの定義のところで作ります。アイスとかサンダーは別の関数で作ります。
// モードとカラーボール選択はここで作りましょう。
// HSBやめたから普通にlerpColorで作る。

// colorIdやめてbuttonColorを渡すように仕様変更
function createColorButtonGraphic(w, h, buttonColor, paleRatio = 0.0, innerText = ""){
  let gr = createGraphics(w, h);
	gr.rectMode(CENTER);
	gr.noStroke();
	const edgeLength = min(w, h) * 0.1;
	// paleRatioで未選択の場合に色が薄くなるようにする。
  const baseColor = lerpColor(buttonColor, color(255), paleRatio);
  // 薄い部分
	gr.fill(lerpColor(baseColor, color(255), 0.3));
	gr.rect(w / 2, h / 2, w, h);
  // 濃い部分
	gr.fill(lerpColor(baseColor, color(0), 0.3));
	gr.rect(w / 2 + edgeLength * 0.5, h / 2 + edgeLength * 0.5, w - edgeLength, h - edgeLength);
  // 本体。必要なら文字を記述する。
	gr.fill(baseColor);
	gr.rect(w / 2, h / 2, w - edgeLength * 2, h - edgeLength * 2);

	if(innerText === ""){ return gr; }
	gr.fill(0);
	gr.textSize(h * 0.4);
	gr.textAlign(CENTER, CENTER);
	gr.text(innerText, w / 2, h / 2);
	return gr;
}

// 特殊なボール選択のためのボタングラフィック。
// アイス限定ではなく汎用にした方がいいに決まってるのでそうする。
// スペシャルボールボタングラフィック。
// 画像とpale情報だけ送るように変更。
// 背景めんどうだから灰色系にした
function createSpecialBallButtonGraphic(w, h, ballGraphic, paleRatio = 0.0){
	let gr = createGraphics(w, h);
	const baseColor = lerpColor(color(64), color(255), paleRatio);
	gr.noStroke();
	gr.fill(lerpColor(baseColor, color(255), 0.3));
	gr.rect(0, 0, w, h);
	//const iceBallGraphic = createFunction(paleRatio);
	const t = min(w, h);
	const r = ORIGIN_BALL_RADIUS;
	gr.image(ballGraphic, w/2 - t/2, h/2 - t/2, t, t, 0, 0, r * 2.4, r * 2.4);
	return gr;
}

// ボタンを作る。やっぱColorButtonは廃止かな・・全部NormalButtonにする流れで。テキストとかも必要なら用意する感じで。
// とりあえず色とテキストだけのボタンをモード変更用とカラーボール選択用に作る。
// アイスボールとかそっちは個別に関数を作る。ColorButtonは一応残しておくけど実質廃止みたいな感じかな・・
// hueはやめてパレットには16進数コードを載せておく。これ使ってボールの画像とか作る。ボール画像はwhiteとの距離を縮めることで
// 発光時のグラフィックを作れるようにしよう。
// ボードの方は色暗くしたけど、こっちは逆にinActiveなときは色を薄くしたい。ボールと揃えたいね。以上。

// ---------------------------------------------------------------------------------------- //
// drawFunction.
// particle描画用の関数

function drawTriangle(x, y, radius, rotationAngle, shapeColor){
	// (x, y)を中心とする三角形、radiusは重心から頂点までの距離。
	let p = [];
	for(let i = 0; i < 3; i++){
		p.push({x:x + radius * cos(rotationAngle + PI * i * 2 / 3), y:y + radius * sin(rotationAngle + PI * i * 2 / 3)});
	}
	fill(shapeColor);
	triangle(p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y);
}

function drawSquare(x, y, radius, rotationAngle, shapeColor){
	// (x, y)を中心とする正方形、radiusは重心から頂点までの距離。
	let p = [];
	for(let i = 0; i < 4; i++){
		p.push({x:x + radius * cos(rotationAngle + PI * i * 2 / 4), y:y + radius * sin(rotationAngle + PI * i * 2 / 4)});
	}
	fill(shapeColor);
	quad(p[0].x, p[0].y, p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
}

function drawStar(x, y, radius, rotationAngle, shapeColor){
	// (x, y)を中心としdirection方向にradius離れててstarColorで塗りつぶしてやる感じ
	// radiusは外接円の半径
	let p = [];
	for(let i = 0; i < 5; i++){
		p.push({x:x + radius * cos(rotationAngle + 2 * PI * i / 5), y:y + radius * sin(rotationAngle + 2 * PI * i / 5)});
	}
	const shortLength = radius * sin(PI / 10) / cos(PI / 5);
	for(let i = 0; i < 5; i++){
		p.push({x:x - shortLength * cos(rotationAngle + 2 * PI * i / 5), y:y - shortLength * sin(rotationAngle + 2 * PI * i / 5)});
	}
	fill(shapeColor);
	triangle(p[1].x, p[1].y, p[8].x, p[8].y, p[9].x, p[9].y);
	triangle(p[4].x, p[4].y, p[6].x, p[6].y, p[7].x, p[7].y);
	quad(p[0].x, p[0].y, p[2].x, p[2].y, p[5].x, p[5].y, p[3].x, p[3].y);
}

function drawCross(x, y, radius, rotationAngle, shapeColor){
  // なんかquad4つのやつ
	let p = [];
	for(let i = 0; i < 4; i++){
		p.push({x:x + radius * cos(rotationAngle + PI * i / 2), y:y + radius * sin(rotationAngle + PI * i / 2)});
	}
	for(let i = 0; i < 4; i++){
		p.push({x:x + radius * 0.3 * cos(rotationAngle + PI * (i + 0.5) / 2), y:y + radius * 0.3 * sin(rotationAngle + PI * (i + 0.5) / 2)});
	}
	fill(shapeColor);
	quad(x, y, p[4].x, p[4].y, p[0].x, p[0].y, p[7].x, p[7].y);
	quad(x, y, p[5].x, p[5].y, p[1].x, p[1].y, p[4].x, p[4].y);
	quad(x, y, p[6].x, p[6].y, p[2].x, p[2].y, p[5].x, p[5].y);
	quad(x, y, p[7].x, p[7].y, p[3].x, p[3].y, p[6].x, p[6].y);
}

// -------------------------------------------------------------------------------------------------------------------- //
// Button.
// 背景選択ボタン、ボール選択ボタン、モード選択ボタンの3種類。
// ADD:ボールを追加する。
// MOV:ボールを動かす。
// DEL:ボールを削除する。

// アニメ要らんわ

class Button{
	constructor(left, top, w, h){
		this.left = left;
		this.top = top;
		this.w = w;
		this.h = h;
		this.active = false;
	}
	setOffSet(offSetX, offSetY){
		this.offSetX = offSetX;
		this.offSetY = offSetY;
	}
	activate(){
		this.active = true;
	}
	inActivate(){
		this.active = false;
	}
	hit(){
		// クリック位置がボタンに触れてるかどうかをこれで判定する。
		const x = mouseX - this.offSetX;
		const y = mouseY - this.offSetY;
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
// colorIdやめてbuttonColorを渡すように仕様変更
class ColorButton extends Button{
	constructor(left, top, w, h, buttonColor, innerText = ""){
		super(left, top, w, h);
		this.activeGraphic = createColorButtonGraphic(w, h, buttonColor, 0.0, innerText);
		this.inActiveGraphic = createColorButtonGraphic(w, h, buttonColor, 0.7, innerText);
	}
	draw(gr){
		// 画像は大きさを変えずにそのまま使う（文字のサイズとか変わっちゃうのでサムネ方式では駄目）
		if(this.active){
			gr.image(this.activeGraphic, this.left, this.top);
		}else{
			gr.image(this.inActiveGraphic, this.left, this.top);
		}
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
		// 信じられない、AREA_WIDTHとかになってた。再利用できないじゃん。
		if(this.active){
			gr.image(this.activeGraphic, this.left, this.top, this.w, this.h,
				       0, 0, this.activeGraphic.width, this.inActiveGraphic.height);
		}else{
			gr.image(this.inActiveGraphic, this.left, this.top, this.w, this.h,
				       0, 0, this.activeGraphic.width, this.inActiveGraphic.height);
		}
	}
}

// ボタンを集めただけ。配列。
class ButtonSet{
	constructor(){
		this.buttons = [];
		this.size = 0; // ボタンの個数
		//this.activeButtonId = 0;
	}
	initialize(offSetX, offSetY){
	  /* 初期化 */
		for(let btn of this.buttons){
			btn.setOffSet(offSetX, offSetY);
		}
	}
	addColorButton(left, top, w, h, buttonColor, innerText = ""){
		// ColorButtonを追加する
		this.buttons.push(new ColorButton(left, top, w, h, buttonColor, innerText));
		this.size++;
	}
	addNormalButton(left, top, w, h, activeGraphic, inActiveGraphic){
		// NormalButtonを追加する
		this.buttons.push(new NormalButton(left, top, w, h, activeGraphic, inActiveGraphic));
		this.size++;
	}
	getTargetButtonId(){
		// クリック位置がボタンにヒットするならそれのidを返すがなければ-1を返す。
    for(let i = 0; i < this.size; i++){
			if(this.buttons[i].hit()){ return i; }
		}
		return -1;
	}
	activate(){ /* ボタンのactivate関連処理 */ }
	draw(gr){
		// ボタンが多い場合に・・表示工夫したり必要なんかな。
		for(let btn of this.buttons){ btn.draw(gr); }
	}
}

// 一度にひとつのボタンしかアクティブにならないボタンセット
class UniqueButtonSet extends ButtonSet{
	constructor(initialActiveButtonId = 0){
		super();
		this.activeButtonId = initialActiveButtonId;  // 最初にアクティブになっているボタンのid（デフォは0）
	}
	initialize(offSetX, offSetY){
		super.initialize(offSetX, offSetY);
		this.buttons[this.activeButtonId].activate();
	}
	getActiveButtonId(){
		// activeなボタンのidは一意なのでそれを返す。
		return this.activeButtonId;
	}
	activate(){
    // クリック位置がボタンにヒットする場合に、それをactivateして、それ以外をinActivateする感じ。
		const targetButtonId = this.getTargetButtonId();
		if(targetButtonId < 0){ return; }
    this.buttons[this.activeButtonId].inActivate();
		this.activeButtonId = targetButtonId;
		this.buttons[this.activeButtonId].activate();
	}
}

// 一度に複数のボタンがアクティブになれるボタンセット
// 使わないけどね（何で用意したの）
class MultiButtonSet extends ButtonSet{
	constructor(){
		super();
		this.activeState = [];
	}
	initialize(offSetX, offSetY){
		super.initialize(offSetX, offSetY);
		for(let i = 0; i < this.size; i++){ this.activeState.push(false); }
	}
	getActiveState(){
		return this.activeState;
	}
	activate(){
		// クリック位置のボタンのactiveを切り替える感じ。
		const targetButtonId = this.getTargetButtonId();
		if(targetButtonId < 0){ return; }
		let btn = this.buttons[targetButtonId];
		if(btn.active){ btn.inActivate(); }else{ btn.activate(); }
		this.activeState[targetButtonId] = btn.active;
	}
}

// ---------------------------------------------------------------------------------------- //
// Particle and ParticleSystem.
// ボールが消滅するときのエフェクト。

class Particle{
	constructor(x, y, particleHue){
		this.center = {};
	}
	initialize(x, y, direction, baseColor, drawFunction, sizeFactor, hopFlag){
		this.center.x = x;
		this.center.y = y;
		this.direction = direction; // 方向指定
	  this.finalDistance = random(MIN_DISTANCE, MAX_DISTANCE);
		this.life = PARTICLE_LIFE; // 寿命は固定しよう。
		this.color = baseColor;
		this.rotationAngle = random(2 * PI); // 回転の初期位相
		this.radius = random(MIN_RADIUS, MAX_RADIUS) * sizeFactor; // 本体の半径. 6～24がデフォで、大きさをsizeFactorで調整する。
		this.alive = true;
		this.drawFunction = drawFunction;
		this.hop = hopFlag;
	}
	update(){
		this.life--;
		this.rotationAngle += PARTICLE_ROTATION_SPEED;
		if(this.life === 0){ this.alive = false; }
	}
	draw(){
		let prg = (PARTICLE_LIFE - this.life) / PARTICLE_LIFE;
		prg = sqrt(prg * (2 - prg));
		//const particleColor = color(this.colorData.r, this.colorData.g, this.colorData.b, 255 * (1 - prg));
		this.color.setAlpha(255 * (1 - prg));
		let x = this.center.x + this.finalDistance * prg * cos(this.direction);
		let y = this.center.y + this.finalDistance * prg * sin(this.direction);
		if(this.hop){
			// ぽ～ん効果
			y -= prg * (1 - prg) * 4.0 * this.finalDistance * 0.5;
		}
    this.drawFunction(x, y, this.radius, this.rotationAngle, this.color);
	}
	remove(){
		if(this.alive){ return; }
		this.belongingArray.remove(this);
		particlePool.recycle(this);
	}
}

// クリックするとその位置にパーティクルが出現するようにしたいのです。うん。
// デモじゃないのでそれはありえません（ごめんね）
class ParticleSystem{
	constructor(){
		this.particleArray = new CrossReferenceArray();
		this.directionRange = [0, 2 * PI]; // ここをいじると色んな方向にとびだす
		//this.lifeFactor = 1.0;
		this.sizeFactor = 1.0;
		this.hop = false; // particleが放物線を描くかどうか。デフォはまっすぐ。
	}
	createParticle(x, y, baseColor, drawFunction, particleNum){
		for(let i = 0; i < particleNum; i++){
			let ptc = particlePool.use();
			// 一応基本は[0, 2 * PI]で。特定方向に出す場合も考慮・・
			const direction = random(this.directionRange[0], this.directionRange[1]);
			ptc.initialize(x, y, direction, baseColor, drawFunction, this.sizeFactor, this.hop);
			this.particleArray.add(ptc);
		}
	}
	setDirectionRange(rangeArray){
		this.directionRange = rangeArray;
		return this;
	}
	setSizeFactor(sizeFactor){
		this.sizeFactor = sizeFactor;
		return this;
	}
	setHop(flag){
		this.hop = flag;
		return this;
	}
	update(){
		this.particleArray.loop("update");
	}
	draw(){
		this.particleArray.loop("draw");
	}
	remove(){
		this.particleArray.loopReverse("remove");
	}
}

// ---------------------------------------------------------------------------------------- //
// ObjectPool.
// particleを出すためのプール

class ObjectPool{
	constructor(objectFactory = (() => ({})), initialCapacity = 0){
		this.objPool = [];
		this.nextFreeSlot = null; // 使えるオブジェクトの存在位置を示すインデックス
		this.objectFactory = objectFactory;
		this.grow(initialCapacity);
	}
	use(){
		if(this.nextFreeSlot == null || this.nextFreeSlot == this.objPool.length){
		  this.grow(this.objPool.length || 5); // 末尾にいるときは長さを伸ばす感じ。lengthが未定義の場合はとりあえず5.
		}
		let objToUse = this.objPool[this.nextFreeSlot]; // FreeSlotのところにあるオブジェクトを取得
		this.objPool[this.nextFreeSlot++] = EMPTY_SLOT; // その場所はemptyを置いておく、そしてnextFreeSlotを一つ増やす。
		return objToUse; // オブジェクトをゲットする
	}
	recycle(obj){
		if(this.nextFreeSlot == null || this.nextFreeSlot == -1){
			this.objPool[this.objPool.length] = obj; // 図らずも新しくオブジェクトが出来ちゃった場合は末尾にそれを追加
		}else{
			// 考えづらいけど、this.nextFreeSlotが0のときこれが実行されるとobjPool[-1]にobjが入る。
			// そのあとでrecycleが発動してる間は常に末尾にオブジェクトが増え続けるからFreeSlotは-1のまま。
			// そしてuseが発動した時にその-1にあったオブジェクトが使われてそこにはEMPTY_SLOTが設定される
			this.objPool[--this.nextFreeSlot] = obj;
		}
	}
	grow(count = this.objPool.length){ // 長さをcountにしてcount個のオブジェクトを追加する
		if(count > 0 && this.nextFreeSlot == null){
			this.nextFreeSlot = 0; // 初期状態なら0にする感じ
		}
		if(count > 0){
			let curLen = this.objPool.length; // curLenはcurrent Lengthのこと
			this.objPool.length += Number(count); // countがなんか変でも数にしてくれるからこうしてるみたい？"123"とか。
			// こうするとかってにundefinedで伸ばされるらしい・・長さプロパティだけ増やされる。
			// 基本的にはlengthはpushとか末尾代入（a[length]=obj）で自動的に増えるけどこうして勝手に増やすことも出来るのね。
			for(let i = curLen; i < this.objPool.length; i++){
				// add new obj to pool.
				this.objPool[i] = this.objectFactory();
			}
			return this.objPool.length;
		}
	}
	size(){
		return this.objPool.length;
	}
}

// ---------------------------------------------------------------------------------------- //
// CrossReferenceArray.
// particleを格納するための配列。

class CrossReferenceArray extends Array{
	constructor(){
    super();
	}
  add(element){
    this.push(element);
    element.belongingArray = this; // 所属配列への参照
  }
  remove(element){
    let index = this.indexOf(element, 0);
    this.splice(index, 1); // elementを配列から排除する
  }
  loop(methodName){
		if(this.length === 0){ return; }
    // methodNameには"update"とか"display"が入る。まとめて行う処理。
		for(let i = 0; i < this.length; i++){
			this[i][methodName]();
		}
  }
	loopReverse(methodName){
		if(this.length === 0){ return; }
    // 逆から行う。排除とかこうしないとエラーになる。もうこりごり。
		for(let i = this.length - 1; i >= 0; i--){
			this[i][methodName]();
		}
  }
	clear(){
		this.length = 0;
	}
}

// ---------------------------------------------------------------------------------------- //
// Cursor and Slider.
// サイズ変更用のカーソルとスライダー。

// 使い方。
// 先にカーソルをサイズや形、色指定して生成する。
// それを元にスライダーを生成。形状はとりあえず直線が用意してある。
// mousePressedでactivateしてmouseReleasedでinActivateするだけ。
// 使う前にinitializeでカーソルの位置を調整するの忘れずに。
// 値の取得はgetValueでminとmaxの値に応じて返されるのでそれを使って何でもできる。
// 気になるなら値の取得をmouseIsPressedの間だけにすればいい。以上。

// コンフィグエリアが指定されてその上に描画することが多いと思うのでそういう前提で書いてる・・悪しからず。

// offSetX, offSetYのプロパティを追加。コンフィグエリアの位置情報がないとhitをきちんと実行できない。

// スライダー。
class Slider{
  constructor(minValue, maxValue, cursor){
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.cursor = cursor;
    this.active = false;
  }
  initialize(offSetX, offSetY){
    /* カーソルの初期位置を決める */
    // offSetX, offSetYはスライダーを置くエリアのleftとtopに当たるポイント。hitのところであれする。
    this.offSetX = offSetX;
    this.offSetY = offSetY;
  }
  activate(){
    // マウス位置がカーソルにヒットしなければactiveにしない。
    if(!this.cursor.hit(mouseX - this.offSetX, mouseY - this.offSetY)){ return; }
    this.active = true;
  }
  inActivate(){
    this.active = false;
  }
  getValue(){ /* カーソルの位置と自身のレールデータから値を取り出す処理。形状による。 */ }
  update(){ /* activeであればmouseIsPressedである限りカーソルの位置を更新し続ける */ }
  draw(gr){ /* レールの形状がスライダーによるのでここには何も書けない */ }
}

// startとendは位置ベクトルで、それぞれがminとmaxに対応する。
class LineSlider extends Slider{
  constructor(minValue, maxValue, cursor, start, end){
    super(minValue, maxValue, cursor);
    this.start = start;
    this.end = end;
    this.length = p5.Vector.dist(start, end);
    this.lineWeight = 3.0;
  }
  initialize(offSetX, offSetY){
    super.initialize(offSetX, offSetY);
    // start位置におく。
    this.cursor.setPosition(this.start.x, this.start.y);
  }
  getValue(){
    // cursorのpositionのstartとendに対する相対位置の割合(prg)からvalueを割り出す。
    const prg = p5.Vector.dist(this.start, this.cursor.position) / this.length;
    return this.minValue * (1 - prg) + this.maxValue * prg;
  }
  update(){
    if(!this.active){ return; }
    // マウス位置から垂線を下ろしてratioを割り出す。ratioはconstrainで0以上1以下に落とす。
    const mousePosition = createVector(mouseX - this.offSetX, mouseY - this.offSetY);
    let ratio = p5.Vector.dot(p5.Vector.sub(this.start, this.end), p5.Vector.sub(this.start, mousePosition)) / pow(this.length, 2);
    ratio = constrain(ratio, 0, 1);
    const newPos = p5.Vector.add(p5.Vector.mult(this.start, 1 - ratio), p5.Vector.mult(this.end, ratio));
    this.cursor.setPosition(newPos.x, newPos.y);
  }
  draw(gr){
    gr.stroke(0);
    gr.strokeWeight(this.lineWeight);
    gr.line(this.start.x, this.start.y, this.end.x, this.end.y);
    gr.noStroke();
    this.cursor.draw(gr);
  }
}
// カーソル。
class Cursor{
  constructor(type, param, marginFactor = 1.0, cursorColor = color(0)){
    this.type = type;
    this.position = createVector();
    this.param = param;
    this.marginFactor = marginFactor; // マウスダウン位置がカーソルの当たり判定からはみ出していても大丈夫なように。
    // たとえば1.1なら|x-mouseX|<(w/2)*1.1までOKとかそういうの。円形なら・・分かるよね。
    this.cursorColor = cursorColor; // カーソルの色。
    // offSetXとoffSetYは中心からgraphicの描画位置までの距離。
    switch(type){
      case "rect":
        this.offSetX = param.w * 0.5;
        this.offSetY = param.h * 0.5;
        break;
      case "circle":
        this.offSetX = param.r;
        this.offSetY = param.r;
        break;
    }
    this.graphic = this.createCursorGraphic();
  }
  createCursorGraphic(){
    // とりあえず単純に（あとできちんとやる）
    switch(this.type){
      case "rect":
        return createRectCursorGraphic(this.param.w, this.param.h, this.cursorColor);
      case "circle":
        return createCircleCursorGraphic(this.param.r, this.cursorColor);
    }
    return gr;
  }
  setPosition(x, y){
    this.position.set(x, y);
  }
  hit(x, y){
    const {x:px, y:py} = this.position;
    switch(this.type){
      case "rect":
        return abs(x - px) < this.param.w * 0.5 * this.marginFactor && abs(y - py) < this.param.h * 0.5 * this.marginFactor;
      case "circle":
        return pow(x - px, 2) + pow(y - py, 2) < pow(this.param.r * this.marginFactor, 2);
    }
  }
  draw(gr){
    gr.image(this.graphic, this.position.x - this.offSetX, this.position.y - this.offSetY);
  }
}

// RectCursorの描画用
function createRectCursorGraphic(w, h, cursorColor){
  let gr = createGraphics(w, h);
  gr.noStroke();
  const edgeSize = min(w, h) * 0.1;
  const bodyColor = cursorColor;
  gr.fill(lerpColor(bodyColor, color(255), 0.4));
  gr.rect(0, 0, w, h);
  gr.fill(lerpColor(bodyColor, color(0), 0.4));
  gr.rect(edgeSize, edgeSize, w - edgeSize, h - edgeSize);
  for(let i = 0; i < 50; i++){
    gr.fill(lerpColor(bodyColor, color(255), 0.5 * (i / 50)));
    gr.rect(edgeSize + (w/2 - edgeSize) * (i / 50), edgeSize + (h/2 - edgeSize) * (i / 50),
            (w - 2 * edgeSize) * (1 - i / 50), (h - 2 * edgeSize) * (1 - i / 50));
  }
  return gr;
}

// CircleCursorの描画用
function createCircleCursorGraphic(r, cursorColor){
  let gr = createGraphics(r * 2, r * 2);
  gr.noStroke();
  const bodyColor = cursorColor;
  for(let i = 0; i < 50; i++){
    gr.fill(lerpColor(bodyColor, color(255), 0.5 * (i / 50)));
    gr.circle(r, r, 2 * r * (1 - i / 50));
  }
  return gr;
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
	mySystem.activateSlider();
	// 各種色変え、重さ替えなど。色変えは普通にパレット。重さ替えは灰色のグラデーションで数字書いてね。
	if(x > AREA_WIDTH){ return; }
	switch(mySystem.getModeId()){
		case 0:
		  /* ADD */
			if(mySystem.addBallCheck(x, y)){ mySystem.addBall(x, y); }
			break;
		case 1:
		  /* MOVE */
			const shootingBall = mySystem.findBall(x, y);
			//if(shootingBall !== undefined){ mySystem.setShootingBall(shootingBall); }
			if(shootingBall){ mySystem.setShootingBall(shootingBall); }
			break;
		case 2:
		  /* DELETE */
			const deletingBall = mySystem.findBall(x, y);
			//if(deletingBall !== undefined){ mySystem.deleteBall(deletingBall); }
			if(deletingBall){ mySystem.deleteBall(deletingBall); }
			break;
	}
  return false;
}


function mouseReleased(){
	mySystem.inActivateSlider();
	switch(mySystem.getModeId()){
		case 1:
		  /* MOVE */
			mySystem.shootBall();
			break;
	}
  return false;
}

// -------------------------------------------------------------------------------------------------------------------- //
// CreateStage.

function createStage0(_system){
  // ball5_1を作ってみる。
  const pos = {x:200, y:60 + 55 * 2 / 3};
  _system.addColorBall(pos, 0)
         .addColorBall(advancePosition(pos, PI * 2 / 3), 1)
         .addColorBall(advancePosition(pos, PI * 2 / 3), 1)
         .addColorBall(advancePosition(pos, 0), 2)
         .addColorBall(advancePosition(pos, PI * 2 / 3), 0)
         .addColorBall(advancePosition(advancePosition(pos, PI * 2 / 3), PI / 3), 2);

  _system.addColorBall({x:180, y:520}, 5);
}


// -------------------------------------------------------------------------------------------------------------------- //
// Utility.
// NearColor廃止。なんか用意するかは未定。

function getNextPosition(pos, direction, multiple = 1.0){
  // posをdirection方向にBALL_RADIUSの2倍の何倍かだけ進ませたところの位置を取得。
  return {x:pos.x + BALL_SPACE * 2 * cos(direction) * multiplier, y:pos.y + BALL_SPACE * 2 * sin(direction) * multiplier};
}

function advancePosition(pos, direction, multiplier = 1.0){
  // posをdirection方向にBALL_RADIUSの2倍の何倍かだけ進ませる。
  pos.x += BALL_SPACE * 2 * cos(direction) * multiplier;
  pos.y += BALL_SPACE * 2 * sin(direction) * multiplier;
  return pos;
}

// -------------------------------------------------------------------------------------------------------------------- //
// Pattern.
// まあ、ボール作って速度与えてってやろうと思えばできるからね・・インタラクションないけど面白いとは思う（わからんけどね）。
// はい。冗談おわり。デバッグしようね・・・

// だめだ。めり込み処理やらないとおかしなことになる（特に見栄えが）。
// ちゃんと動いてるけどね・・きびしいな・・・

// 重心座標系でやるの？なるほど・・なんかおかしいと思った。じゃあuとvをそういうものとしてやるのね。んー・・むぅ。
// よく考えたら速度についてはいじってないんだっけね。

// だからー、壁の場合はそのままでいいんだけど、ぶつかる場合は、positionのずらし方を変える。
// 接するところまで戻す。で、そのうえで接触面を計算して、反射させるんだね（複雑・・）

// 多分接するところまで戻せたはず。さて、本題に入るんだが・・（気力）

// めり込む処理間違ってたので修正しました。正しいかどうかはcollision部分を抜き出して別のプログラムを作る必要がありそうです。おわり。
