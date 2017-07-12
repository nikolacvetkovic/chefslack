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

// Menu.create({
//     monday: "Ćufte",
//     tuesday: "Musaka",
//     wednesday: "Prebranac",
//     thursday: "Pene sa parmezanom",
//     friday: "Gulaš"
// }, function(err, menu){
//     if(err){
//         console.log(err);
//     } else {
//         console.log(menu);
//     }
// });

var userSchema = new mongoose.Schema({
    username: String,
    password: String
});
userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", userSchema);

var orderSchema = new mongoose.Schema({
   user: String,
   date: String
});

var Order = mongoose.model("Order", orderSchema);

// var date = new Date();
// var dateString = date.toDateString();
// Order.create({
//     user: "cvele",
//     date: dateString
// }, function(err, order){
//     if(err){
//         console.log(err);
//     } else {
//         console.log(order);
//     }
// });

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
            res.render("index", {menu: menu});
        }
    }); 
});

server.post("/menu/:id", isLoggedIn, function(req, res){
    Menu.findByIdAndUpdate(req.params.id, req.body.menu, function(err, updatedMenu){
        if(err){
            console.log(err);
            res.render("result", {message: "Neuspešna promena podataka."});
        } else {
            res.render("result", {message: "Uspešna promena podataka."});   
        }
    });
});

server.post("/order", function(req, res) {
    var date = new Date();
    var dateString = date.toDateString();
    var json = JSON.parse(req.body.payload);
    var user = json.user.name;
    Order.create({
        user: user,
        date: dateString
    }, function(err, order){
        if(err){
            console.log(err);
        } else {
            console.log(order);
            res.status(200).end();
        }
    });
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


/////////////////////////////////////////

server.get("/meal", function(req, res) {
    // sendMorningMessageSlack();
    sendFinalMessageSlack();
    res.send("cao");
});


/* ************************************ */
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}

function createMorningMessage(meal){
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
                    actions: [
                        {
                            name: "order",
                            text: "Poruči",
                            style: "primary",
                            type: "button",
                            value: "dodajme"
                        }
                    ]
                }
            ]
    };
    return jsonObject;
}

function createFinalMessage(orders){
    var message = ":chef: Broj porudžbina: *" + orders.length +"*" + "\nNaručioci: \n";
    
    orders.forEach(function(order, index){
        message = message + (index+1) +". " + order.user + "\n";
    });
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
                var meal = menu[day];
                var message = createMorningMessage(meal);
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
            
        });
    }
}

function sendFinalMessageSlack(){
    var date = new Date();
    var dateString = date.toDateString();
    Order.find({date: dateString}, function(err, orders){
        if(err){
            console.log(err);
        } else {
            var message = createFinalMessage(orders);
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

// var morningJob = new cronJob("00 26 23 * * 1-5", sendMorningMessageSlack, 
//     function(){
//     console.log("Morning message sent.");
//     },
//     true,
//     'Europe/Belgrade'
// );

var morningJob = schedule.scheduleJob("00 30 23 * * 1-5", sendFinalMessageSlack);

/* -------------------------------------------------------------------------- */
server.listen(process.env.PORT, process.env.IP, function(){
    console.log("Listening..."); 
});