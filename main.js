var http        =   require('http');
var fs          =   require('fs');
var url         =   require('url');
var chron       =   require('chron')();
var sqlite3     =   require('sqlite3');

//comment

var bot = new SaltyBot();
chron.add(10,bot.tick);

function SaltyBot(){
console.log('SaltyBot');

    var dirPath         =   './Documents/SaltyBets/';
    var currentDate;
    var currentDay;
    //var rModifiedDate;
    var modifiedDates=[new Date(),new Date(),new Date()];
    var modifiedDate=new Date();
    var priorModifiedDate;
    var priorStatus;
    var priorCombatants={};
    var my              =   this;

    var requestOptions  =   {
        method:     'HEAD',
        host:       'www.saltybet.com',
        port:       80,
        path:       '/zdata.json'
    };

    var getZData        =   function getZData(res){
        var jsonAsString=   '';
        res.setEncoding('utf8');
        res.on('data'       ,   (d)     =>  {    jsonAsString          +=d; });
        res.on('end'        ,   ()      =>  {
            try{logZData(JSON.parse(jsonAsString));}
            catch(e){console.log(`getZData:  ${e}`);}
        });
        res.on('error'      ,   logError);
    };



    var logZData        =   function logZData(zdata){

        var sameP1      =   zdata.p1name == priorCombatants.p1;
        var sameP2      =   zdata.p2name == priorCombatants.p2;
        var sameCombatants= sameP1 && sameP2;
        if((zdata.status !== 'locked') && (priorStatus === 'locked') && sameCombatants){
            findWinner(zdata);
        }
        console.log(`priorStatus:  ${priorStatus}\nzdata.status:  ${zdata.status}`);
        if(zdata.status === 'locked' && priorStatus !== 'locked' ){
            //logWagers(zdata);
            logRound(zdata);
        }
        priorStatus     =   zdata.status;
        priorCombatants =   {'p1':zdata.p1name,'p2':zdata.p2name};
    }



    var findWinner      =   function findWinner(zdata){
        var bettors     =   {};
        var bettorsArray=   [];
        var p1Winnings  =   0;
        var p2Winnings  =   0;

        for(i in zdata){
            var item        =   zdata[i];
            if(!isNaN(parseInt(i))){
                bettors[item.n]=item.b;
            }
        }

        db.serialize(function(err){
            if(err){console.log(err);}

            db.each('SELECT * FROM wagers WHERE date = '+modifiedDates[1].getTime(),function(err,row){
                if(err){console.log(err);}
                var oldBank     =   row.bank;
                var newBank     =   bettors[row.username];
                var diff        =   newBank-oldBank;

                if(row.player == 1){p1Winnings+=diff;}
                if(row.player == 2){p2Winnings+=diff;}
            })
            db.run('',function(e){
                var winner      =   p1Winnings > p2Winnings? 1:2;
                console.log(`WINNER:  ${p1Winnings}/${p2Winnings}  ${winner}`);
                //db.run('UPDATE rounds SET winner = ? WHERE winner = 0',winner);
                db.run('UPDATE rounds SET winner = ? WHERE date = '+modifiedDates[1].getTime(),winner);
            });
        })//SERIALIZE;
    };



    var logRound        =   function logRound(zdata){
console.log(`logRound ${zdata.p1name}/${zdata.p2name}`);
        var p1total         =   parseInt(zdata.p1total.replace(/,/g,''));
        var p2total         =   parseInt(zdata.p2total.replace(/,/g,''));

        var ab          =   parseFloat((p1total/p2total).toString());
        var ba          =   parseFloat((p2total/p1total).toString());
        var odds        =   ab>ba?ab:ba;
        //odds            =   parseFloat(odds.toString().slice(0,3));
        var favor       =   ab>ba?1:2;

        var remaining;
        var mode;

        var a               =   zdata.remaining.split(' ');
        var startsWithNumber=   !isNaN(parseInt(a[0]));
        if(startsWithNumber){
            switch(a[a.length-1]){
                case 'tournament!'  : //matchmaking mode
                    remaining       =   a[0];
                    mode            =   0;
                    break;

                case 'bracket!':    //tournament mode
                    remaining       =   a[0];
                    mode            =   1;
                    break;

                case 'left!':       //exhibition mode
                    remaining       =   a[0];
                    mode            =   2;
                    break;
            }
        }else{
            switch(a[0]){
                case 'Tournament'   :   //matchmaking ends
                    remaining       =   1;
                    mode            =   0;
                    break;

                case 'FINAL'        :       //tournament ends
                    remaining       =   2;
                    mode            =   1;
                    break;

                case 'Matchmaking'  :  //exhibition ends
                    remaining       =   1;
                    mode            =   2;
                    break;
            }
        }
        //db.run('begin transaction');
        db.run('INSERT INTO rounds VALUES (?,?,?,?,?,?,?,?,?,?)',
            zdata.p1name,
            zdata.p2name,
            p1total,
            p2total,
            odds,
            favor,
            0,
            //zdata.status,
            //zdata.remaining,
            remaining,
            mode,
            modifiedDates[2].getTime(),
            function(e){
                if(!!e){
                    console.log(e);
                }else{logWagers(zdata);}
            }
        );
        //db.run('commit');
    };

    var logWagers       =   function logWagers(zdata){
        for (i in zdata){
            var item    =   zdata[i];
            if(!isNaN(parseInt(i))){
                //db.run('begin transaction');
                db.run('INSERT INTO wagers VALUES (?,?,?,?,?)',
                    item.n,
                    item.w,
                    item.b,
                    item.p,
                    modifiedDates[2].getTime()
                );
                //db.run('commit');
            }
        }
    };

    var startSQL        =   function startSQL(){
        db      =   new sqlite3.Database('test3.db');
        db.serialize(function() {
            var wagersTemplate    =   '';
            wagersTemplate+=      'username   TEXT NOT NULL,';
            wagersTemplate+=      'wager      INTEGER NOT NULL,';
            wagersTemplate+=      'bank       INTEGER NOT NULL,';
            wagersTemplate+=      'player     INTEGER NOT NULL,';
            wagersTemplate+=      'date       INTEGER NOT NULL';
            //template+=      'r          INTEGER NOT NULL';
            //db.run('CREATE TABLE wagers ('+wagersTemplate+')');
            db.run('CREATE TABLE IF NOT EXISTS wagers ('+wagersTemplate+')');


            var roundsTemplate      =   '';
            roundsTemplate+=        'p1name     TEXT NOT NULL,';
            roundsTemplate+=        'p2name     TEXT NOT NULL,';
            roundsTemplate+=        'p1total    INTEGER NOT NULL,';
            roundsTemplate+=        'p2total    INTEGER NOT NULL,';
            roundsTemplate+=        'odds       REAL NOT NULL,';
            roundsTemplate+=        'favor      INTEGER NOT NULL,';
            roundsTemplate+=        'winner     INTEGER NOT NULL,';
            //roundsTemplate+=        'status     TEXT NOT NULL,';
            //roundsTemplate+=        'remaining  TEXT NOT NULL,';
            roundsTemplate+=        'remaining  INTEGER NOT NULL,';
            roundsTemplate+=        'mode       INTEGER NOT NULL,';
            roundsTemplate+=        'date       INTEGER NOT NULL PRIMARY KEY';
            //db.run('CREATE TABLE rounds ('+roundsTemplate+')');
            db.run('CREATE TABLE IF NOT EXISTS rounds ('+roundsTemplate+')');

            //db.run('begin transaction');
            //wagers          =   db.prepare("INSERT INTO wagers VALUES (?,?,?,?,?)");
            //rounds          =   db.prepare("INSERT INTO rounds VALUES (?,?,?,?,?,?,?,?,?,?)");
        });
    }

    //POKE THE SERVER'S HEADERS TO SEE IF THEY'VE CHANGED;
    var checkModified       =   function checkModified(response){
        response.on('error',logError);
        var rModifiedDate           =       new Date(response.headers['last-modified']);
        if( modifiedDates[2].toJSON()   !==     rModifiedDate.toJSON()){
            modifiedDates.push(rModifiedDate);
            modifiedDates.shift();

            priorModifiedDate       =       modifiedDate;
            modifiedDate            =       rModifiedDate;
            //console.log(`modifiedDate ${modifiedDate.getTime()}`);
            //console.log(`priorModifiedDate ${priorModifiedDate.getTime()}\n`);

            http.get('http://www.saltybet.com/zdata.json', getZData).on('error',logError);
        }
    };

    //IF IT'S TOMORROW, WRITE WAGERS INTO A SINGLE DAILY WAGER FILE;
    var checkDate   =   function checkDate(){
        var oldDay  =   currentDate.getDay();
        var newDay  =   new Date().getDay();
        if(oldDay !== newDay){

        }
    };

    var logError    =   function logError(x)    {if(x){console.log(`logError:  ${x}`);}};

    //CHECK IF WAGERS ARE MODIFIED EACH TICK;
    this.tick       =   function tick(){
        var req     =   http.request(requestOptions, checkModified);
        req.on('error', logError);
        req.end();
    };

    var init        =   function init(){
        startSQL();
        currentDate  =   new Date();
        my.tick();
    };

    init();
}
