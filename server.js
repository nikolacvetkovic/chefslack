var     express                 = require("express"),
        bodyParser              = require("body-parser"),
        expressSession          = require("express-session"),
        mongoose                = require("mongoose"),
        passport                = require("passport"),
        LocalStrategy           = require("passport-local"),
        passportLocalMongoose   = require("passport-local-mongoose"),
        cron                    = require("cron"),
        request                 = require("request"),
        cronJob                 = cron.CronJob,
        schedule                = require("node-schedule"),
        server                  = express();
        


mongoose.connect(process.env.DATABASEURL);

/* STATIC ARRAY FOR DAYS IN WEEK */
var daysInWeek = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday"
};


/* SCHEMAS AND MODELS */
var menuSchema = new mongoose.Schema({
    monday: String,
    tuesday: String,
    wednesday: String,
    thursday: String,
    friday: String
});

var Menu = mongoose.model("Menu", menuSchema);

var userSchema = new mongoose.Schema({
    username: String,
    password: String
});
userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", userSchema);

var orderSchema = new mongoose.Schema({
   user: String,
   date: String,
   option: String
});

var Order = mongoose.model("Order", orderSchema);

var optionSchema = new mongoose.Schema({
    monday: {
        option1: String,
        option2: String
    },
    tuesday: {
        option1: String,
        option2: String
    },
    wednesday: {
        option1: String,
        option2: String
    },
    thursday: {
        option1: String,
        option2: String
    },
    friday: {
        option1: String,
        option2: String
    }
});

var Option = mongoose.model("Option", optionSchema);

/* SETTINGS */
server.set("view engine", "ejs");
server.use(express.static("public"));
server.use(bodyParser.urlencoded({extended: true}));
server.use(expressSession({
    secret: "RUUCAAK",
    resave: false,
    saveUninitialized: false
}));

server.use(passport.initialize());
server.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/* ROUTES */
server.get("/", isLoggedIn, function(req, res){
    Menu.findById(process.env.MENUID, function(err, menu){
        if(err){
            console.log(err);
            res.redirect("/result");
        } else {
            Option.findById(process.env.OPTIONID, function(err, options){
                if(err){
                    console.log(err);
                    res.redirect("/result");
                } else {
                    res.render("index", {menu: menu, options: options});
                }
            });
        }
    }); 
});

server.post("/menu/:menuId/:optionId", isLoggedIn, function(req, res){
    Menu.findByIdAndUpdate(req.params.menuId, req.body.menu, function(err, updatedMenu){
        if(err){
            console.log(err);
            res.render("result", {message: "Neuspešna promena podataka."});
        } else {
            var mondayOpt1, mondayOpt2, tuesdayOpt1, tuesdayOpt2, wednesdayOpt1, wednesdayOpt2, thursdayOpt1, thursdayOpt2, fridayOpt1, fridayOpt2 = undefined;
            if(req.body.mondayOpt1 !== ""){
                mondayOpt1 = req.body.mondayOpt1;
            }
            if(req.body.mondayOpt2 !== ""){
                mondayOpt2 = req.body.mondayOpt2;
            }
            if(req.body.tuesdayOpt1 !== ""){
                tuesdayOpt1 = req.body.tuesdayOpt1;
            }
            if(req.body.tuesdayOpt2 !== ""){
                tuesdayOpt2 = req.body.tuesdayOpt2;
            }
            if(req.body.wednesdayOpt1 !== ""){
                wednesdayOpt1 = req.body.wednesdayOpt1;
            }
            if(req.body.wednesdayOpt2 !== ""){
                wednesdayOpt2 = req.body.wednesdayOpt2;
            }
            if(req.body.thursdayOpt1 !== ""){
                thursdayOpt1 = req.body.thursdayOpt1;
            }
            if(req.body.thursdayOpt2 !== ""){
                thursdayOpt2 = req.body.thursdayOpt2;
            }
            if(req.body.fridayOpt1 !== ""){
                fridayOpt1 = req.body.fridayOpt1;
            }
            if(req.body.fridayOpt2 !== ""){
                fridayOpt2 = req.body.fridayOpt2;
            }
            var option = {
                monday:{
                    option1: mondayOpt1,
                    option2: mondayOpt2
                },
                tuesday:{
                    option1: tuesdayOpt1,
                    option2: tuesdayOpt2
                },
                wednesday:{
                    option1: wednesdayOpt1,
                    option2: wednesdayOpt2
                },
                thursday:{
                    option1: thursdayOpt1,
                    option2: thursdayOpt2
                },
                friday:{
                    option1: fridayOpt1,
                    option2: fridayOpt2
                }
            };
            Option.findByIdAndUpdate(req.params.optionId, option, function(err, updatedOption){
                if(err){
                    console.log(err);
                    res.render("result", {message: "Neuspešna promena podataka."});
                } else {
                    res.render("result", {message: "Uspešna promena podataka."});
                }
            });
        }
    });
});

server.post("/order", function(req, res) {
    var date = new Date();
    var dateString = date.toDateString();
    var day = daysInWeek[date.getDay()];
    var json = JSON.parse(req.body.payload);
    var user = json.user.name;
    var option = json.actions[0].value;
    Option.findById(process.env.OPTIONID, function(err, options) {
        if(err){
            console.log(err);
        } else {
            if(option === options[day].option1 || option === options[day].option2){
                Order.create({
                    user: user,
                    date: dateString,
                    option: option
                }, function(err, order){
                    if(err){
                        console.log(err);
                    } else {
                        console.log(order);
                        res.status(200).end();
                        var url = "https://slack.com/api/chat.postMessage?token="+process.env.TOKEN+"&channel="+json.user.id+"&text=Uspešno ste poručili&as_user=true";
                        request(encodeURI(url), function(error, response, body) {
                            if(error){
                                console.log(error);
                            } else {
                                console.log(response.statusCode);
                            }
                        });
                    }
                });
            } else {
                Order.create({
                    user: user,
                    date: dateString,
                    option: undefined
                }, function(err, order){
                    if(err){
                        console.log(err);
                    } else {
                        console.log(order);
                        res.status(200).end();
                        var url = "https://slack.com/api/chat.postMessage?token="+process.env.TOKEN+"&channel="+json.user.id+"&text=Uspešno ste poručili&as_user=true";
                        request(encodeURI(url), function(error, response, body) {
                            if(error){
                                console.log(error);
                            } else {
                                console.log(response.statusCode);
                            }
                        });
                    }
                });
            }
        }
    })
});

server.get("/login", function(req, res){
    res.render("login");
});

server.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}), function(req, res){
});

server.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/login");
});

/* ************************************ */
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}

function createMorningMessage(meal, option1, option2){
    var jsonObject = { 
        text : ":chef: Dobro jutro. Danas na meniju:",
        attachments: [
                {
                    text: "*"+meal+"*",
                    fallback: "Niste u mogućnosti da odaberete",
                    callback_id: "cheforder",
                    color: "#f49b42",
                    mrkdwn_in: ["text"],
                    attachment_type: "default",
                    actions: []
                }
            ]
    };
    if(option1 !== null){
        jsonObject.text = ":chef: Dobro jutro. Danas na meniju: *" + meal + "*."
        jsonObject.attachments[0].text = "Prilozi:\n*Opcija 1:* "+option1+"    *Opcija 2:* "+option2;
        jsonObject.attachments[0].actions.push({
            name: "order1",
            text: "Poruči opciju 1",
            style: "primary",
            type: "button",
            value: option1
        });
        jsonObject.attachments[0].actions.push({
            name: "order2",
            text: "Poruči opciju 2",
            style: "danger",
            type: "button",
            value: option2
        });
    } else {
        jsonObject.attachments[0].actions.push({
            name: "order",
            text: "Poruči",
            style: "primary",
            type: "button",
            value: "dodajme"
        });
    }
    return jsonObject;
}

function createFinalMessage(orders, option1, option2){
    
    if(option1 !== null){
        var countOrder1 = 0;
        var countOrder2 = 0;
        orders.forEach(function(order) {
            if(order.option === option1){
                countOrder1++;
            }
            if(order.option === option2){
                countOrder2++;
            }
        })
        var message = ":chef: Broj porudžbina -> "+ option1.capitalizeFirstLetter() +": *" + countOrder1 +"*   "+ option2.capitalizeFirstLetter() + ": *" + countOrder2 +"*\nNaručioci:\n";
        orders.forEach(function(order, index){
            message = message + (index+1) +". " + order.user + " - "+ order.option + "\n";
        });
    } else {
        var message = ":chef: Broj porudžbina: *" + orders.length +"*" + "\nNaručioci: \n";
        orders.forEach(function(order, index){
            message = message + (index+1) +". " + order.user + "\n";
        });
    }
    
    var jsonObject = {
        text : message
    };
    return jsonObject;
}

function sendMorningMessageSlack(){
    var date = new Date();
    var day = daysInWeek[date.getDay()];
    if(day !== undefined){
        Menu.findById(process.env.MENUID, function(err, menu){
            if(err){
                console.log(err);
            } else {
                Option.findById(process.env.OPTIONID, function(err, options){
                    if(err){
                        console.log(err);
                    } else {
                        var option1 = options[day].option1;
                        var option2 = options[day].option2;
                        var meal = menu[day];
                        var message = createMorningMessage(meal, option1, option2);
                        // REQUEST
                        request({
                            uri: process.env.SLACKURL,
                            method: "POST",
                            json: message
                        }, function(error, response, body){
                            if(error){
                                console.log(error);
                            } else {
                                console.log(response.statusCode);
                            }    
                        });
                    }
                })
            }
        });
    }
}

function sendFinalMessageSlack(){
    var date = new Date();
    var dateString = date.toDateString();
    var day = daysInWeek[date.getDay()];
    Order.find({date: dateString}, function(err, orders){
        if(err){
            console.log(err);
        } else {
            Option.findById(process.env.OPTIONID, function(err, options) {
                if(err){
                    console.log(err);
                } else {
                    var option1 = options[day].option1;
                    var option2 = options[day].option2;
                    var message = createFinalMessage(orders, option1, option2);
                    // REQUEST
                    request({
                        uri: process.env.SLACKURL,
                        method: "POST",
                        json: message
                    }, function(error, response, body) {
                        if(error){
                        console.log(error);
                    } else {
                        console.log(response.statusCode);
                    }
                    });
                }
            });
        }
    });
}

String.prototype.capitalizeFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

function wakeUp(){
    request(process.env.MYURL, function(error, response, body) {
        if(error){
            console.log(error);
        } else {
            console.log(response.statusCode);
        }
    });
}

/* CRON JOBS */
var morningJob = schedule.scheduleJob("0 0 9 * * 1-5", sendMorningMessageSlack);

var pingJob1 = schedule.scheduleJob("0 15 9 * * 1-5", wakeUp); 
var pingJob2 = schedule.scheduleJob("0 40 9 * * 1-5", wakeUp); 
var pingJob3 = schedule.scheduleJob("0 0 10 * * 1-5", wakeUp); 
var pingJob3 = schedule.scheduleJob("0 20 10 * * 1-5", wakeUp); 

var finalJob = schedule.scheduleJob("0 30 10 * * 1-5", sendFinalMessageSlack);

/* -------------------------------------------------------------------------- */
server.listen(process.env.PORT, process.env.IP, function(){
    console.log("Listening..."); 
});