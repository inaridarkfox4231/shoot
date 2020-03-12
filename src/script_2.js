// スピンオフ企画
// 正方形のエリア
// 中心に向かって加速度が生じている（いろいろ調整）
// コンフィグは全部廃止、ガターも廃止
// 代わりとしての地形効果。
// 地形効果だけ残す・・？背景選択は残してみるか。
// 背景ごとに地形効果を変えて実験してみようか。背景選択を縦並びにして。面白そう。
// 4種類のカラーボールが周囲のエリアに自然発生する
// 上限30個
// 少ないほど出やすい
// よって衝突が起こりやすい
// たのしいたのしいボールの遊び

// 負荷がすごいので、面白いけど、没。

p5.DisableFriendlyErrors = true;
"use strict";

let mySystem;

const AREA_WIDTH =  640;
const AREA_HEIGHT = AREA_WIDTH * 1.0;
//const GUTTER_PROPORTION = 0.1;

const ORIGIN_BALL_RADIUS = 100; // 画像用の半径。これを元にボール画像を作って、個別の描画ではこれを渡して適切に拡縮して使う。

const BALL_RADIUS = AREA_WIDTH * 0.048; // ボールの半径は0.045くらいにする。配置するときは0.05だと思って配置する。隙間ができる。OK!
const BALL_APPEAR_MARGIN = AREA_WIDTH * 0.001; // ボールの直径が0.1の中の0.09になるように配置するイメージで設定している。
const FRICTION_COEFFICIENT = 0.02; // 摩擦の大きさ（0.01から0.02に上げてみた）
const SPEED_LOWER_LIMIT = AREA_WIDTH * 0.00025; // 速さの下限（これ以下になったら0として扱う）

const SPEED_UPPER_LIMIT = AREA_WIDTH * 0.05; // セットするスピードの上限。横幅の5%でいく。（ちょっと下げる）

// ColorBallの色はパレットから出すことにしました。
// 順に赤、オレンジ、黄色、緑、水色、青、紫、ピンク。
const COLOR_PALETTE = ["#ff0000", "#ffa500", "#ffff00", "#008000", "#00bfff", "#0000cd", "#800080", "#ff1493", "#32cd32",
                       "#00a1e9", "#ffd700", "#888"];
// たとえば色によってサイズを変えるのであれば
// const SIZE_FACTOR = [1.0, 1.2, 1.4, 1.6, 1.8, etc...]
// とかしてその値を使うことになるかな・・
const BALL_CAPACITY = 30; // 30個まで増やせるみたいな。

// particle関連
let particlePool;
const EMPTY_SLOT = Object.freeze(Object.create(null)); // ダミーオブジェクト

const PARTICLE_LIFE = 60; // 寿命
const PARTICLE_ROTATION_SPEED = 0.12; // 形状の回転スピード
const MIN_DISTANCE = 30; // 到達距離
const MAX_DISTANCE = 60;
const MIN_RADIUS = 6; // 大きさ
const MAX_RADIUS = 24;

// 音はあきらめる。

function setup(){
	createCanvas(AREA_WIDTH, AREA_HEIGHT);
	noStroke();
	particlePool = new ObjectPool(() => { return new Particle(); }, 512);
  mySystem = new System();
}

function draw(){
  mySystem.update();
  mySystem.draw();
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

// -------------------------------------------------------------------------------------------------------------------- //
// System.

class System{
  constructor(){
		// 背景とガターの作成
		this.boardId = 0;
		this.boardGraphic = createBoardGraphic(); // 背景工夫したいねって

		// ボール
    this.balls = [];
    this.createBallGraphics();

		// パーティクル関連
		this.particles = new ParticleSystem();

    // 地形効果、ジェネレータ
    this.effect = new NormalSlope(0.0004);
    this.generator = new AroundBallGenerator(5, [1.0, 1.0], 120);
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
	}
  addColorBall(x, y, colorId, ballSizeFactor){
    const normalGraphic = this.ballGraphic.normal[colorId];
    const paleGraphic = this.ballGraphic.pale[colorId];
    this.balls.push(new ColorBall(x, y, normalGraphic, ballSizeFactor, paleGraphic, colorId));
    return this;
  }
	createParticleAtRemove(_ball){
		// ボールを排除するときのparticle出力
		const {x, y} = _ball.position;
		this.particles.setSizeFactor(_ball.radius / BALL_RADIUS); // 半径に応じて大きさを変える
		this.particles.setHop(true);
		this.particles.createParticle(x, y, color(COLOR_PALETTE[_ball.colorId]), drawStar, 20);
	}
	createParticleAtCollide(_ball, collidePoint){
		// ボールが衝突するときのparticle出力
		// 発生ポイントを衝突時の接点にしたいのでそこだけ修正。
		//const {x, y} = _ball.position;
		const {x, y} = collidePoint;
		this.particles.setSizeFactor(_ball.radius * 0.5 / BALL_RADIUS); // リムーブ時の半分
		this.particles.setHop(true);
		this.particles.createParticle(x, y, color(COLOR_PALETTE[_ball.colorId]), drawTriangle, 5);
	}
  update(){
    for(let b of this.balls){ b.update(); }
		this.particles.update(); // particleのupdate.
    this.generator.update();
    if(this.generator.getSignal() && this.balls.length < BALL_CAPACITY){ this.generator.generate(this); }
    this.applyEffect();
    this.applyCollide();
    this.removeObjects();
  }
  applyEffect(){
    for(let b of this.balls){ this.effect.applyEffect(b); }
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
  draw(){
		// 背景描画
		image(this.boardGraphic.active[this.boardId], 0, 0);
    // ボール描画
    for(let b of this.balls){ b.draw(); }
		this.particles.draw(); // particleのdraw.
  }
}

// -------------------------------------------------------------------------------------------------------------------- //
// GroundEffect.
// 地形効果。

class GroundEffect{
  constructor(){}
  applyEffect(_ball){}
}

// NormalSlope。中心に向かって一定スピードで加速。
class NormalSlope extends GroundEffect{
  constructor(attractionRatio = 0.0002){
    super();
    this.attraction = AREA_WIDTH * attractionRatio;
  }
  applyEffect(_ball){
    const directionToCenter = atan2(AREA_HEIGHT * 0.5 - _ball.position.y, AREA_WIDTH * 0.5 - _ball.position.x);
    _ball.velocity.x += this.attraction * cos(directionToCenter);
    _ball.velocity.y += this.attraction * sin(directionToCenter);
    if(_ball.velocity.mag() > SPEED_UPPER_LIMIT){
      const direction = _ball.velocity.heading();
      _ball.setVelocity(SPEED_UPPER_LIMIT, direction);
    }
  }
}

// SliverTray. お盆。中心にいくほど加速が弱くなる感じ。のやつ。

// -------------------------------------------------------------------------------------------------------------------- //
// Pattern.
// パターンを作ります。

// kindMax:全部で何種類まで出すか
// interval:何フレームおきに出すか。
// 共通のメソッドとして、ランダムで位置を決める際のあれこれ、位置を決めたとしてそれで大丈夫、ああそれSystemの方に書いたっけ。
// 何回か試せばいいよ。周囲でお願いね。
class BallGenerator{
  constructor(kindMax, sizeFactorRange, limit){
    this.kindMax = kindMax;
    this.sizeFactorRange = sizeFactorRange; // たとえば[1.0, 1.0]みたいな。
    this.kindRatio = new Array(kindMax);  //
    this.limit = limit;
    this.properFrameCount = 0;
    this.signal = true;
  }
  getSignal(){
    // signalがtrueである限りボール発生のgenerateを呼び出し続けて発生に成功したらfalseにして
    // falseである限りupdateでproperFrameCountを増やし続けてlimitに達したら・・以下略。
    return this.signal;
  }
  calcGeneratePosition(_system, ballSizeFactor){
    // 発生位置の計算。多分物による。位置を返す{x:x, y:y}. サイズも考慮する。
    // 万が一発生させられない時はundefinedを返す。
    return undefined;
  }
  getBallColor(_system){
    // 出現させることが決まった場合に、ボールの色を決める関数部分を独立させる。

    // デフォルトとして1を用意しておく。0があっても計算できるように。大小関係は変わらないから問題ないでしょ。
    this.kindRatio.fill(1);
    for(const b of _system.balls){ this.kindRatio[b.colorId]++; }
    // 数の割合の逆数を取って全部足してその値で割って・・
    for(let i = 0; i < this.kindMax; i++){ this.kindRatio[i] = 1 / this.kindRatio[i]; }
    const ratioSum = this.kindRatio.reduce((x, y) => { return x + y; });
    for(let i = 0; i < this.kindMax; i++){ this.kindRatio[i] /= ratioSum; }
    // バリデーション配列(0～1)。ここに0番目が出る確率、0か1番目が出る確率、・・って入れてく。最後は1っぽい。
    let validationArray = [];
    let tmp = 0;
    for(let i = 0; i < this.kindMax; i++){
      tmp += this.kindRatio[i];
      validationArray.push(tmp);
    }
    //console.log(validationArray);
    const r = random(1);
    for(let i = 0; i < this.kindMax; i++){
      if(r > validationArray[i]){ continue; }
      return i;
    }
    // なんか変な時はとりあえず最後のを。
    return this.kindMax - 1;
  }
  generate(_system){
    // ボールの個数によるバリデーションはsystem側に書く。

    // まず発生させることができるかどうか調べる。それにはcalcGeneratePositionで計算して・・
    // サイズ取って位置取ってチェックして駄目ならもっかいを10回くらいやってヒットすればそれを返す、なければundefinedが帰っておしまい。
    // で、出現が決まったら上のやつで色を取得してボールを出す。
    // signalをfalseにする。
    const left = this.sizeFactorRange[0];
    const right = this.sizeFactorRange[1];
    const ballSizeFactor = abs(left + random(1) * (right - left));
    const position = this.calcGeneratePosition(_system, ballSizeFactor);
    if(position === undefined){ return; }
    const ballColorId = this.getBallColor(_system);
    _system.addColorBall(position.x, position.y, ballColorId, ballSizeFactor);
    this.signal = false;
  }
  update(){
    if(!this.signal){ this.properFrameCount++; }
    if(this.properFrameCount === this.limit){
      this.signal = true;
      this.properFrameCount = 0;
    }
  }
}

// 周囲に発生させる感じ。
class AroundBallGenerator extends BallGenerator{
  constructor(kindNum, sizeFactorRange, interval){
    super(kindNum, sizeFactorRange, interval);
  }
  calcGeneratePosition(_system, ballSizeFactor){
    // 壁から一定距離のすべての位置を走査してどっかから出す感じ。
    const newBallRadius = BALL_RADIUS * ballSizeFactor;

    // 4隅の座標計算用。たとえば平行四辺形とかもこれでいけるね（？）
    const left = newBallRadius + BALL_APPEAR_MARGIN;
    const right = AREA_WIDTH - newBallRadius - BALL_APPEAR_MARGIN;
    const top = newBallRadius + BALL_APPEAR_MARGIN;
    const bottom = AREA_HEIGHT - newBallRadius - BALL_APPEAR_MARGIN;

    // ボール配置用ベクトル族
    let start = createVector();
    let end = createVector();
    let position = createVector();

    for(let i = 0; i < 10; i++){
      let seed = random(1) * 4;
      let q = floor(seed);
      let r = seed - q;
      let ballSetFlag = true;
      switch(q){
        case 0:
          start.set(left, top); end.set(right, top); break;
        case 1:
          start.set(right, top); end.set(right, bottom); break;
        case 2:
          start.set(right, bottom); end.set(left, bottom); break;
        case 3:
          start.set(left, bottom); end.set(left, top); break;
      }
      position.set(p5.Vector.add(start.mult(r), end.mult(1 - r)));
      for(const b of _system.balls){
        if(p5.Vector.dist(position, b.position) < newBallRadius + b.radius + BALL_APPEAR_MARGIN){
          ballSetFlag = false;
          break;
        }
      }
      // 1回でもOKが出たらpositionを返す。
      if(ballSetFlag){ return position; }
    }
    // 10回やってだめならundefinedを返す。まあ基本1回でOKだろうけど。
    return undefined;
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
	//collideSound.play();
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
