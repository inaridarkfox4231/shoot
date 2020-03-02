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

// 背景、今回は茶色のグラデーションに挑戦したい。色を4段階くらいで分けて、レンガみたいに互い違いして、接しているところで
// 違う色になるように工夫するの。

//let balls = [];
let mySystem;

const AREA_WIDTH =  360;
const AREA_HEIGHT = AREA_WIDTH * 1.5;
const BALL_RADIUS = AREA_WIDTH * 0.045; // ボールの半径は0.045くらいにする。配置するときは0.05だと思って配置する。隙間ができる。OK!
const FRICTION_COEFFICIENT = 0.01; // 摩擦の大きさ
const SPEED_LOWER_LIMIT = 0.1; // 速さの下限（これ以下になったら0として扱う）

const BALL_HUE_PALLETE = [66, 75, 84, 93, 2, 11, 20, 29, 38, 47, 56]; // 11種類

const CONFIG_WIDTH = AREA_WIDTH * 0.6; // コンフィグの横幅は舞台の60%位を想定。

function setup(){
	createCanvas(AREA_WIDTH + CONFIG_WIDTH, AREA_HEIGHT);
  colorMode(HSB, 100);
	noStroke();
  mySystem = new System();

  ptn0();
}

function draw(){
	background(70);
  mySystem.update();
  mySystem.applyCollide();
  mySystem.draw();
}

// -------------------------------------------------------------------------------------------------------------------- //
// Ball.

class Ball{
	constructor(x, y, colorId = 0, mf = 1.0){
		this.position = createVector(x, y);
		this.velocity = createVector(0, 0);
		this.massFactor = mf;
		this.radius = BALL_RADIUS;
		this.friction = FRICTION_COEFFICIENT;
		this.hue = BALL_HUE_PALLETE[colorId];
    this.brightNess = floor(100 / mf); // 重いほど暗い色にする
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
		fill(this.hue, 100, this.brightNess);
		circle(this.position.x, this.position.y, this.radius * 2);
	}
}

function collisionCheck(_ball, _other){
  return p5.Vector.dist(_ball.position, _other.position) < _ball.radius + _other.radius;
}

// まずball.massFactorとball.velocityとotherのそれから重心のベクトルを出してそれを使って相対速度を作って
// それに対して衝突面の法線ベクトル、これはpositionのsubを取るだけ。これで相対速度を反射させる。
// 最後に重心ベクトルを足しなおせば完成（のはず）
function perfectCollision(_ball, _other){
	// ballとotherが衝突したときの速度の変化を記述する（面倒なので完全弾性衝突で）
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
// System.

class System{
  constructor(){
    this.balls = [];
  }
  addBall(x, y, colorId = 0, mf = 1.0){
    // Ballを追加する
    this.balls.push(new Ball(x, y, colorId, mf));
  }
  findBall(x, y){
    // Ballが(x, y)にあるかどうか調べてあればそのボールのidを返すがなければ-1を返す。
    for(let i = 0; i < this.balls.length; i++){
      const _ball = this.balls[i];
      if(dist(_ball.position.x, _ball.position.y, x, y) < _ball.radius){ return i; }
    }
    return -1;
  }
  removeBall(id){
    // Ballを排除する
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
    for(let b of this.balls){ b.draw(); }
    this.drawConfig();
  }
  drawConfig(){
    fill(30);
    rect(AREA_WIDTH, 0, CONFIG_WIDTH, AREA_HEIGHT);
  }
}

// -------------------------------------------------------------------------------------------------------------------- //
// Interaction.
// 何もないところをクリックした場合、他のボールと衝突しないようなら（壁にめり込んでもダメ）ボールを発生させることができる。
// モードが追加になってる場合、クリック位置にボールがあればpositionとの紐付けが開始されて、マウス位置に向かう。
// 押し下げ位置があって、そのあとのマウス位置に向かうんだけど、ボールから出る矢印は、「現在のposition」から「押し下げた瞬間のpositionまでのベクトル」と
// 「押し下げ位置」から「マウス位置」までのベクトルを足したものになる。ここやや複雑なので注意。これを現在のpositionから引く。
// 削除モードの時にクリックするとボールがなければ空振り、あればそれを排除する。

function mousePressed(){
  return;
}

function mouseReleased(){
  return;
}

// -------------------------------------------------------------------------------------------------------------------- //
// Pattern.
// まあ、ボール作って速度与えてってやろうと思えばできるからね・・インタラクションないけど面白いとは思う（わからんけどね）。
// はい。冗談おわり。デバッグしようね・・・

function ptn0(){
  let b_self = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 0.2, 0);
  let b_top = new Ball(AREA_WIDTH * 0.5, AREA_WIDTH * 0.7, 10);
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
