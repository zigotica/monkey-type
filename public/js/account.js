$(".pageLogin .register input").keyup((e) => {
  if (e.key == "Enter") {
    signUp();
  }
});

$(".pageLogin .register .button").click((e) => {
  signUp();
});

$(".pageLogin .login input").keyup((e) => {
  if (e.key == "Enter") {
    signIn();
  }
});

$(".pageLogin .login .button").click((e) => {
  signIn();
});

$(".signOut").click((e) => {
  signOut();
});

$(".pageAccount .loadMoreButton").click((e) => {
  loadMoreLines();
});

$(".pageLogin #forgotPasswordButton").click((e) => {
  let email = prompt("Email address");
  if (email) {
    firebase
      .auth()
      .sendPasswordResetEmail(email)
      .then(function () {
        // Email sent.
        showNotification("Email sent", 2000);
      })
      .catch(function (error) {
        // An error happened.
        showNotification(error.message, 5000);
      });
  }
});

function showSignOutButton() {
  $(".signOut").removeClass("hidden").css("opacity", 1);
}

function hideSignOutButton() {
  $(".signOut").css("opacity", 0).addClass("hidden");
}

function signIn() {
  $(".pageLogin .preloader").removeClass("hidden");
  let email = $(".pageLogin .login input")[0].value;
  let password = $(".pageLogin .login input")[1].value;

  if ($(".pageLogin .login #rememberMe input").prop("checked")) {
    //remember me
    firebase
      .auth()
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(function () {
        return firebase
          .auth()
          .signInWithEmailAndPassword(email, password)
          .then((e) => {
            changePage("test");
          })
          .catch(function (error) {
            showNotification(error.message, 5000);
            $(".pageLogin .preloader").addClass("hidden");
          });
      });
  } else {
    //dont remember
    firebase
      .auth()
      .setPersistence(firebase.auth.Auth.Persistence.SESSION)
      .then(function () {
        return firebase
          .auth()
          .signInWithEmailAndPassword(email, password)
          .then((e) => {
            changePage("test");
          })
          .catch(function (error) {
            showNotification(error.message, 5000);
            $(".pageLogin .preloader").addClass("hidden");
          });
      });
  }
}

let dontCheckUserName = false;

function signUp() {
  $(".pageLogin .preloader").removeClass("hidden");
  let nname = $(".pageLogin .register input")[0].value;
  let email = $(".pageLogin .register input")[1].value;
  let password = $(".pageLogin .register input")[2].value;
  let passwordVerify = $(".pageLogin .register input")[3].value;

  const namecheck = firebase.functions().httpsCallable("checkNameAvailability");

  namecheck({ name: nname }).then((d) => {
    if (d.data === -1) {
      showNotification("Name unavailable", 3000);
      $(".pageLogin .preloader").addClass("hidden");
      return;
    } else if (d.data === -2) {
      showNotification(
        "Name cannot contain special characters or contain more than 14 characters. Can include _ . and -",
        8000
      );
      $(".pageLogin .preloader").addClass("hidden");
      return;
    } else if (d.data === 1) {
      if (password != passwordVerify) {
        showNotification("Passwords do not match", 3000);
        $(".pageLogin .preloader").addClass("hidden");
        return;
      }
      firebase
        .auth()
        .createUserWithEmailAndPassword(email, password)
        .then((user) => {
          // Account has been created here.
          dontCheckUserName = true;
          let usr = user.user;
          usr
            .updateProfile({
              displayName: nname,
            })
            .then(function () {
              // Update successful.
              firebase
                .firestore()
                .collection("users")
                .doc(usr.uid)
                .set({ name: nname }, { merge: true });
              usr.sendEmailVerification();
              showNotification("Account created", 2000);
              $("#menu .icon-button.account .text").text(nname);
              try {
                firebase.analytics().logEvent("accountCreated", usr.uid);
              } catch (e) {
                console.log("Analytics unavailable");
              }
              $(".pageLogin .preloader").addClass("hidden");
              changePage("account");
            })
            .catch(function (error) {
              // An error happened.
              console.error(error);
              usr
                .delete()
                .then(function () {
                  // User deleted.
                  showNotification("An error occured", 2000);
                  $(".pageLogin .preloader").addClass("hidden");
                })
                .catch(function (error) {
                  // An error happened.
                  $(".pageLogin .preloader").addClass("hidden");
                });
            });
        })
        .catch(function (error) {
          // Handle Errors here.
          var errorCode = error.code;
          var errorMessage = error.message;
          showNotification(errorMessage, 5000);
          $(".pageLogin .preloader").addClass("hidden");
        });
    }
  });
}

function signOut() {
  firebase
    .auth()
    .signOut()
    .then(function () {
      showNotification("Signed out", 2000);
      updateAccountLoginButton();
      changePage("login");
      dbSnapshot = null;
    })
    .catch(function (error) {
      showNotification(error.message, 5000);
    });
}

function sendVerificationEmail() {
  let cu = firebase.auth().currentUser;
  cu.sendEmailVerification()
    .then((e) => {
      showNotification("Email sent to " + cu.email, 4000);
    })
    .catch((e) => {
      showNotification("Error: " + e.message, 3000);
      console.error(e.message);
    });
}

firebase.auth().onAuthStateChanged(function (user) {
  if (user) {
    // User is signed in.
    if (user.emailVerified === false) {
      $(".pageAccount .content").prepend(
        `<p style="text-align:center">Your account is not verified. Click <a onClick="sendVerificationEmail()">here</a> to resend the verification email.`
      );
    }
    updateAccountLoginButton();
    accountIconLoading(true);
    db_getUserSnapshot().then((e) => {
      if (!configChangedBeforeDb) {
        if (cookieConfig === null) {
          dbConfigLoaded = true;
          accountIconLoading(false);
          applyConfig(dbSnapshot.config);
          // showNotification('Applying db config',3000);
          updateSettingsPage();
          saveConfigToCookie(true);
        } else if (dbSnapshot.config !== undefined) {
          let configsDifferent = false;
          Object.keys(config).forEach((key) => {
            if (!configsDifferent) {
              try {
                if (key !== "resultFilters") {
                  if (Array.isArray(config[key])) {
                    config[key].forEach((arrval, index) => {
                      if (arrval != dbSnapshot.config[key][index])
                        configsDifferent = true;
                    });
                  } else {
                    if (config[key] != dbSnapshot.config[key])
                      configsDifferent = true;
                  }
                }
              } catch (e) {
                console.log(e);
                configsDifferent = true;
              }
            }
          });
          if (configsDifferent) {
            dbConfigLoaded = true;
            accountIconLoading(false);
            applyConfig(dbSnapshot.config);
            updateSettingsPage();
            saveConfigToCookie(true);
          }
        }
      } else {
        accountIconLoading(false);
      }
      if (
        config.resultFilters === undefined ||
        config.resultFilters === null ||
        config.resultFilters.difficulty === undefined
      ) {
        config.resultFilters = defaultAccountFilters;
      }
      accountIconLoading(false);
      updateFilterTags();
      updateCommandsTagsList();
      loadActiveTagsFromCookie();
      updateResultEditTagsPanelButtons();
      refreshTagsSettingsSection();
      updateDiscordSettingsSection();
    });
    var displayName = user.displayName;
    var email = user.email;
    var emailVerified = user.emailVerified;
    var photoURL = user.photoURL;
    var isAnonymous = user.isAnonymous;
    var uid = user.uid;
    var providerData = user.providerData;
    // showNotification('Signed in', 1000);
    $(".pageLogin .preloader").addClass("hidden");
    if (!dontCheckUserName) verifyUsername();
    $("#menu .icon-button.account .text").text(displayName);
  }
});

var resultHistoryChart = new Chart($(".pageAccount #resultHistoryChart"), {
  animationSteps: 60,
  type: "line",
  data: {
    datasets: [
      {
        label: "wpm",
        fill: false,
        data: [],
        borderColor: "#f44336",
        borderWidth: 2,
        // trendlineLinear: {
        //   style: "rgba(244,67,54,.25)",
        //   lineStyle: "solid",
        //   width: 1
        // }
        trendlineLinear: {
          style: "rgba(255,105,180, .8)",
          lineStyle: "dotted",
          width: 4,
        },
      },
    ],
  },
  options: {
    tooltips: {
      // Disable the on-canvas tooltip
      enabled: true,
      titleFontFamily: "Roboto Mono",
      bodyFontFamily: "Roboto Mono",
      intersect: false,
      custom: function (tooltip) {
        if (!tooltip) return;
        // disable displaying the color box;
        tooltip.displayColors = false;
      },
      callbacks: {
        // HERE YOU CUSTOMIZE THE LABELS
        title: function () {
          return;
        },
        beforeLabel: function (tooltipItem, data) {
          let resultData =
            data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
          let label =
            `${data.datasets[tooltipItem.datasetIndex].label}: ${
              tooltipItem.yLabel
            }` +
            "\n" +
            `acc: ${resultData.acc}` +
            "\n\n" +
            `mode: ${resultData.mode} `;

          if (resultData.mode == "time") {
            label += resultData.mode2;
          } else if (resultData.mode == "words") {
            label += resultData.mode2;
          }

          let diff = resultData.difficulty;
          if (diff == undefined) {
            diff = "normal";
          }
          label += "\n" + `difficulty: ${diff}`;

          label +=
            "\n" +
            `punctuation: ${resultData.punctuation}` +
            "\n" +
            `language: ${resultData.language}` +
            "\n\n" +
            `date: ${moment(resultData.timestamp).format("DD MMM YYYY HH:mm")}`;

          return label;
        },
        label: function (tooltipItem, data) {
          return;
        },
        afterLabel: function (tooltipItem, data) {
          return;
        },
      },
    },
    animation: {
      duration: 250,
    },
    legend: {
      display: false,
      labels: {
        fontFamily: "Roboto Mono",
        fontColor: "#ffffff",
      },
    },
    responsive: true,
    // maintainAspectRatio: false,
    // tooltips: {
    //   mode: 'index',
    //   intersect: false,
    // },
    hover: {
      mode: "nearest",
      intersect: true,
    },
    scales: {
      xAxes: [
        {
          ticks: {
            fontFamily: "Roboto Mono",
          },
          type: "time",
          bounds: "ticks",
          distribution: "series",
          display: false,
          scaleLabel: {
            display: true,
            labelString: "Date",
          },
        },
      ],
      yAxes: [
        {
          ticks: {
            fontFamily: "Roboto Mono",
            beginAtZero: true,
          },
          display: true,
          scaleLabel: {
            display: false,
            labelString: "Words per Minute",
          },
        },
      ],
    },
  },
});

let defaultAccountFilters = {
  difficulty: {
    normal: true,
    expert: true,
    master: true,
  },
  mode: {
    words: true,
    time: true,
    quote: true,
    custom: true,
  },
  words: {
    10: true,
    25: true,
    50: true,
    100: true,
    200: true,
    custom: true,
  },
  time: {
    15: true,
    30: true,
    60: true,
    120: true,
    custom: true,
  },
  punctuation: {
    on: true,
    off: true,
  },
  date: {
    last_day: false,
    last_week: false,
    last_month: false,
    all: true,
  },
  tags: {
    none: true,
  },
  language: {},
  funbox: {
    none: true,
  },
};

Object.keys(words).forEach((language) => {
  $(
    ".pageAccount .content .filterButtons .buttonsAndTitle.languages .buttons"
  ).append(
    `<div class="button" filter="${language}">${language.replace(
      "_",
      " "
    )}</div>`
  );
  defaultAccountFilters.language[language] = true;
  if (language === "english_expanded") {
    $(
      ".pageAccount .content .filterButtons .buttonsAndTitle.languages .buttons"
    ).append(`<div class="button" filter="english_10k">english 10k</div>`);
    defaultAccountFilters.language["english_10k"] = true;
  }
});

$(
  ".pageAccount .content .filterButtons .buttonsAndTitle.funbox .buttons"
).append(`<div class="button" filter="none">none</div>`);
getFunboxList().then((funboxModes) => {
  funboxModes.forEach((funbox) => {
    $(
      ".pageAccount .content .filterButtons .buttonsAndTitle.funbox .buttons"
    ).append(
      `<div class="button" filter="${funbox.name}">${funbox.name.replace(
        /_/g,
        " "
      )}</div>`
    );
    defaultAccountFilters.funbox[funbox.name] = true;
  });
});

function updateFilterTags() {
  $(
    ".pageAccount .content .filterButtons .buttonsAndTitle.tags .buttons"
  ).empty();
  if (dbSnapshot.tags.length > 0) {
    $(".pageAccount .content .filterButtons .buttonsAndTitle.tags").removeClass(
      "hidden"
    );
    $(
      ".pageAccount .content .filterButtons .buttonsAndTitle.tags .buttons"
    ).append(`<div class="button" filter="none">no tag</div>`);
    dbSnapshot.tags.forEach((tag) => {
      defaultAccountFilters.tags[tag.id] = true;
      $(
        ".pageAccount .content .filterButtons .buttonsAndTitle.tags .buttons"
      ).append(`<div class="button" filter="${tag.id}">${tag.name}</div>`);
    });
  } else {
    $(".pageAccount .content .filterButtons .buttonsAndTitle.tags").addClass(
      "hidden"
    );
  }
  showActiveFilters();
}

function toggleFilter(group, filter) {
  if (group === "date") {
    Object.keys(config.resultFilters.date).forEach((date) => {
      setFilter("date", date, false);
    });
  }
  config.resultFilters[group][filter] = !config.resultFilters[group][filter];
}

function setFilter(group, filter, set) {
  config.resultFilters[group][filter] = set;
}

// function toggleFilterButton(filter) {
//   const element = $(
//     `.pageAccount .content .filterButtons .button[filter=${filter}]`
//   );
//   if (element.hasClass("active")) {
//     //disable that filter

//     if (filter == "all" || filter == "none") {
//       return;
//     } else if (filter == "mode_words") {
//       // $.each($(`.pageAccount .content .filterButtons .buttons.wordsFilter .button`),(index,obj)=>{
//       //   let f = $(obj).attr('filter')
//       //   disableFilterButton(f)
//       // })
//     } else if (filter == "mode_time") {
//       // $.each($(`.pageAccount .content .filterButtons .buttons.timeFilter .button`),(index,obj)=>{
//       //   let f = $(obj).attr('filter')
//       //   disableFilterButton(f)
//       // })
//     } else if (filter == "punc_off") {
//       enableFilterButton("punc_on");
//     } else if (filter == "punc_on") {
//       enableFilterButton("punc_off");
//     }
//     disableFilterButton(filter);
//     disableFilterButton("all");
//   } else {
//     //enable that filter
//     disableFilterButton("none");

//     if (filter == "all") {
//       $.each(
//         $(`.pageAccount .content .filterButtons .button`),
//         (index, obj) => {
//           let f = $(obj).attr("filter");
//           if (
//             f != "none" &&
//             f != "date_month" &&
//             f != "date_week" &&
//             f != "date_day"
//           ) {
//             enableFilterButton(f);
//           }
//         }
//       );
//     } else if (filter == "none") {
//       disableFilterButton("all");
//       $.each(
//         $(`.pageAccount .content .filterButtons .button`),
//         (index, obj) => {
//           let f = $(obj).attr("filter");
//           if (f != "none") {
//             disableFilterButton(f);
//           }
//         }
//       );
//     } else if (
//       filter == "date_all" ||
//       filter == "date_month" ||
//       filter == "date_week" ||
//       filter == "date_day"
//     ) {
//       disableFilterButton("date_all");
//       disableFilterButton("date_month");
//       disableFilterButton("date_week");
//       disableFilterButton("date_day");
//       enableFilterButton(filter);
//     }
//     // else if(filter == "mode_words"){
//     //   $.each($(`.pageAccount .content .filterButtons .buttons.wordsFilter .button`),(index,obj)=>{
//     //     let f = $(obj).attr('filter');
//     //     enableFilterButton(f);
//     //   })
//     // }else if(filter == "mode_time"){
//     //   $.each($(`.pageAccount .content .filterButtons .buttons.timeFilter .button`),(index,obj)=>{
//     //     let f = $(obj).attr('filter');
//     //     enableFilterButton(f);
//     //   })
//     // }else if(['10','25','50','100','200'].includes(filter)){
//     //   enableFilterButton('words');
//     // }else if(['15','30','60','120'].includes(filter)){
//     //   enableFilterButton('time');
//     // }

//     enableFilterButton(filter);
//   }
//   showActiveFilters();
// }

// function disableFilterButton(filter) {
//   const element = $(
//     `.pageAccount .content .filterButtons .button[filter=${filter}]`
//   );
//   element.removeClass("active");
// }

// function enableFilterButton(filter) {
//   const element = $(
//     `.pageAccount .content .filterButtons .button[filter=${filter}]`
//   );
//   element.addClass("active");
// }

function showActiveFilters() {
  // activeFilters = [];
  // $.each($(".pageAccount .filterButtons .button"), (i, obj) => {
  //   if ($(obj).hasClass("active")) {
  //     activeFilters.push($(obj).attr("filter"));
  //   }
  // });

  let aboveChartDisplay = {};

  Object.keys(config.resultFilters).forEach((group) => {
    aboveChartDisplay[group] = {
      all: true,
      array: [],
    };
    Object.keys(config.resultFilters[group]).forEach((filter) => {
      if (config.resultFilters[group][filter]) {
        aboveChartDisplay[group].array.push(filter);
      } else {
        aboveChartDisplay[group].all = false;
      }
      let buttonEl = $(
        `.pageAccount .group.filterButtons .filterGroup[group="${group}"] .button[filter="${filter}"]`
      );
      if (config.resultFilters[group][filter]) {
        buttonEl.addClass("active");
      } else {
        buttonEl.removeClass("active");
      }
    });
  });

  let chartString = "";
  let allall = true;
  let count = 0;
  Object.keys(aboveChartDisplay).forEach((group) => {
    count++;
    if (group === "time" && !aboveChartDisplay.mode.array.includes("time"))
      return;
    if (group === "words" && !aboveChartDisplay.mode.array.includes("words"))
      return;

    if (aboveChartDisplay[group].array.length > 0) {
      chartString += "<div class='group'>";
      if (group == "difficulty") {
        chartString += `<i class="fas fa-fw fa-star"></i>`;
      } else if (group == "mode") {
        chartString += `<i class="fas fa-fw fa-bars"></i>`;
      } else if (group == "punctuation") {
        chartString += `<span class="punc" style="font-weight: 900;
        width: 1.25rem;
        text-align: center;
        display: inline-block;
        letter-spacing: -.1rem;">!?</span>`;
      } else if (group == "words") {
        chartString += `<i class="fas fa-fw fa-font"></i>`;
      } else if (group == "time") {
        chartString += `<i class="fas fa-fw fa-clock"></i>`;
      } else if (group == "date") {
        chartString += `<i class="fas fa-fw fa-calendar"></i>`;
      } else if (group == "tags") {
        chartString += `<i class="fas fa-fw fa-tags"></i>`;
      } else if (group == "language") {
        chartString += `<i class="fas fa-fw fa-globe-americas"></i>`;
      } else if (group == "funbox") {
        chartString += `<i class="fas fa-fw fa-gamepad"></i>`;
      }

      if (aboveChartDisplay[group].all) {
        chartString += "all";
      } else {
        allall = false;
        if (group === "tags") {
          chartString += aboveChartDisplay.tags.array
            .map((id) => {
              if (id == "none") return id;
              return dbSnapshot.tags.filter((t) => t.id == id)[0].name;
            })
            .join(", ");
        } else {
          chartString += aboveChartDisplay[group].array
            .join(", ")
            .replace(/_/g, " ");
        }
      }
      chartString += "</div>";
      if (Object.keys(aboveChartDisplay).length !== count)
        chartString += `<div class="spacer"></div>`;
    }
  });

  if (allall) chartString = `<i class="fas fa-fw fa-filter"></i>all`;

  $(".pageAccount .group.chart .above").html(chartString);

  refreshAccountPage();
}

function showChartPreloader() {
  $(".pageAccount .group.chart .preloader").stop(true, true).animate(
    {
      opacity: 1,
    },
    125
  );
}

function hideChartPreloader() {
  $(".pageAccount .group.chart .preloader").stop(true, true).animate(
    {
      opacity: 0,
    },
    125
  );
}

$(".pageAccount .filterButtons .buttonsAndTitle .buttons").click(
  ".button",
  (e) => {
    const filter = $(e.target).attr("filter");
    const group = $(e.target).parents(".buttons").attr("group");
    // toggleFilterButton(filter);
    if ($(e.target).hasClass("allFilters")) {
      Object.keys(config.resultFilters).forEach((group) => {
        Object.keys(config.resultFilters[group]).forEach((filter) => {
          if (group === "date") {
            config.resultFilters[group][filter] = false;
          } else {
            config.resultFilters[group][filter] = true;
          }
        });
      });
      config.resultFilters.date.all = true;
    } else if ($(e.target).hasClass("noFilters")) {
      Object.keys(config.resultFilters).forEach((group) => {
        Object.keys(config.resultFilters[group]).forEach((filter) => {
          config.resultFilters[group][filter] = false;
        });
      });
    } else {
      if (e.shiftKey) {
        Object.keys(config.resultFilters[group]).forEach((filter) => {
          config.resultFilters[group][filter] = false;
        });
        setFilter(group, filter, true);
      } else {
        toggleFilter(group, filter);
      }
    }
    showActiveFilters();
    saveConfigToCookie();
  }
);

$(".pageAccount #currentConfigFilter").click((e) => {
  // let disableGroups = [
  //   "globalFilters",
  //   "difficultyFilters",
  //   "modeFilters",
  //   "punctuationFilter",
  //   "wordsFilter",
  //   "timeFilter",
  //   "languages",
  //   "tags",
  //   "funbox",
  // ];
  // disableGroups.forEach((group) => {
  //   $.each(
  //     $(`.pageAccount .filterButtons .buttons.${group} .button`),
  //     (index, button) => {
  //       let fl = $(button).attr("filter");
  //       disableFilterButton(fl);
  //       config.resultFilters = config.resultFilters.filter((f) => f !== fl);
  //     }
  //   );
  // });
  // showActiveFilters();

  Object.keys(config.resultFilters).forEach((group) => {
    Object.keys(config.resultFilters[group]).forEach((filter) => {
      config.resultFilters[group][filter] = false;
    });
  });

  //rewrite this monstrosity soon pls
  // config.resultFilters.push(`difficulty_${config.difficulty}`);
  // toggleFilterButton(`difficulty_${config.difficulty}`);
  // config.resultFilters.push(`mode_${config.mode}`);
  // toggleFilterButton(`mode_${config.mode}`);
  // if (config.mode === "time") {
  //   config.resultFilters.push(`time_${config.time}`);
  //   toggleFilterButton(`time_${config.time}`);
  // } else if (config.mode === "words") {
  //   config.resultFilters.push(`words_${config.words}`);
  //   toggleFilterButton(`words_${config.words}`);
  // }
  // let puncfilter = config.punctuation ? "punc_on" : "punc_off";
  // config.resultFilters.push(puncfilter);
  // toggleFilterButton(puncfilter);
  // config.resultFilters.push(`lang_${config.language}`);
  // toggleFilterButton(`lang_${config.language}`);

  // config.resultFilters.push(`funbox_${activeFunBox}`);
  // toggleFilterButton(`funbox_${activeFunBox}`);

  // let activeTags = [];
  // try {
  //   dbSnapshot.tags.forEach((tag) => {
  //     if (tag.active === true) {
  //       activeTags.push(tag.id);
  //     }
  //   });
  // } catch (e) {}

  // if (activeTags.length > 0) {
  //   activeTags.forEach((tag) => {
  //     config.resultFilters.push(`tag_${tag}`);
  //     toggleFilterButton(`tag_${tag}`);
  //   });
  // } else {
  //   config.resultFilters.push(`tag_notag`);
  //   toggleFilterButton(`tag_notag`);
  // }

  config.resultFilters.difficulty[config.difficulty] = true;
  config.resultFilters.mode[config.mode] = true;
  if (config.mode === "time") {
    config.resultFilters.time[config.time] = true;
  } else if (config.mode === "words") {
    config.resultFilters.words[config.words] = true;
  }
  if (config.punctuation) {
    config.resultFilters.punctuation.on = true;
  } else {
    config.resultFilters.punctuation.off = true;
  }
  config.resultFilters.language[config.language] = true;
  config.resultFilters.funbox[activeFunBox] = true;
  config.resultFilters.tags.none = true;
  dbSnapshot.tags.forEach((tag) => {
    if (tag.active === true) {
      config.resultFilters.tags.none = false;
      config.resultFilters.tags[tag.id] = true;
    }
  });

  config.resultFilters.date.all = true;

  showActiveFilters();
  saveConfigToCookie();
});

let filteredResults = [];
let visibleTableLines = 0;

function loadMoreLines() {
  if (filteredResults == [] || filteredResults.length == 0) return;
  for (let i = visibleTableLines; i < visibleTableLines + 10; i++) {
    result = filteredResults[i];
    if (result == undefined) continue;
    let withpunc = "";
    // if (result.punctuation) {
    //   withpunc = '<br>punctuation';
    // }
    // if (result.blindMode) {
    //   withpunc = '<br>blind';
    // }
    let diff = result.difficulty;
    if (diff == undefined) {
      diff = "normal";
    }

    let raw = result.rawWpm;
    if (raw == undefined) {
      raw = "-";
    }

    let icons = `<span aria-label="${result.language.replace(
      "_",
      " "
    )}" data-balloon-pos="up"><i class="fas fa-fw fa-globe-americas"></i></span>`;

    if (diff === "normal") {
      icons += `<span aria-label="${result.difficulty}" data-balloon-pos="up"><i class="far fa-fw fa-star"></i></span>`;
    } else if (diff === "expert") {
      icons += `<span aria-label="${result.difficulty}" data-balloon-pos="up"><i class="fas fa-fw fa-star-half-alt"></i></span>`;
    } else if (diff === "master") {
      icons += `<span aria-label="${result.difficulty}" data-balloon-pos="up"><i class="fas fa-fw fa-star"></i></span>`;
    }

    if (result.punctuation) {
      icons += `<span aria-label="punctuation" data-balloon-pos="up" style="font-weight:900">!?</span>`;
    }

    if (result.blindMode) {
      icons += `<span aria-label="blind mode" data-balloon-pos="up"><i class="fas fa-fw fa-eye-slash"></i></span>`;
    }

    if (result.funbox !== "none" && result.funbox !== undefined) {
      icons += `<span aria-label="${result.funbox.replace(
        /_/g,
        " "
      )}" data-balloon-pos="up"><i class="fas fa-gamepad"></i></span>`;
    }

    let tagNames = "";

    if (result.tags !== undefined && result.tags.length > 0) {
      result.tags.forEach((tag) => {
        dbSnapshot.tags.forEach((snaptag) => {
          if (tag === snaptag.id) {
            tagNames += snaptag.name + ", ";
          }
        });
      });
      tagNames = tagNames.substring(0, tagNames.length - 2);
    }

    // if(tagNames !== ""){
    //   icons += `<span aria-label="${tagNames}" data-balloon-pos="up"><i class="fas fa-fw fa-tag"></i></span>`;
    // }

    let restags;
    if (result.tags === undefined) {
      restags = "[]";
    } else {
      restags = JSON.stringify(result.tags);
    }

    let tagIcons = `<span id="resultEditTags" resultId="${result.id}" tags='${restags}' aria-label="no tags" data-balloon-pos="up" style="opacity: .25"><i class="fas fa-fw fa-tag"></i></span>`;

    if (tagNames !== "") {
      if (result.tags !== undefined && result.tags.length > 1) {
        tagIcons = `<span id="resultEditTags" resultId="${result.id}" tags='${restags}' aria-label="${tagNames}" data-balloon-pos="up"><i class="fas fa-fw fa-tags"></i></span>`;
      } else {
        tagIcons = `<span id="resultEditTags" resultId="${result.id}" tags='${restags}' aria-label="${tagNames}" data-balloon-pos="up"><i class="fas fa-fw fa-tag"></i></span>`;
      }
    }

    let consistency = result.consistency;

    if (consistency === undefined) {
      consistency = "-";
    } else {
      consistency += "%";
    }

    $(".pageAccount .history table tbody").append(`
    <tr>
    <td>${result.wpm}</td>
    <td>${raw}</td>
    <td>${result.acc}%</td>
    <td>${result.correctChars}</td>
    <td>${result.incorrectChars}</td>
    <td>${consistency}</td>
    <td>${result.mode} ${result.mode2}${withpunc}</td>
    <td class="infoIcons">${icons}</td>
    <td>${tagIcons}</td>
    <td>${moment(result.timestamp).format("DD MMM YYYY<br>HH:mm")}</td>
    </tr>`);
  }
  visibleTableLines += 10;
  if (visibleTableLines >= filteredResults.length) {
    $(".pageAccount .loadMoreButton").addClass("hidden");
  } else {
    $(".pageAccount .loadMoreButton").removeClass("hidden");
  }
}

function refreshAccountPage() {
  function cont() {
    refreshThemeColorObject();

    let chartData = [];
    visibleTableLines = 0;

    let topWpm = 0;
    let topMode = "";
    let testRestarts = 0;
    let totalWpm = 0;
    let testCount = 0;

    let last10 = 0;
    let wpmLast10total = 0;

    let totalAcc = 0;
    let totalAcc10 = 0;

    let rawWpm = {
      total: 0,
      count: 0,
      last10Total: 0,
      last10Count: 0,
      max: 0,
    };

    let totalSeconds = 0;
    let totalSecondsFiltered = 0;

    let totalCons = 0;
    let totalCons10 = 0;
    let consCount = 0;

    filteredResults = [];
    $(".pageAccount .history table tbody").empty();
    dbSnapshot.results.forEach((result) => {
      let tt = 0;
      if (result.testDuration == undefined) {
        //test finished before testDuration field was introduced - estimate
        if (result.mode == "time") {
          tt = parseFloat(result.mode2);
        } else if (result.mode == "words") {
          tt = (parseFloat(result.mode2) / parseFloat(result.wpm)) * 60;
        }
      } else {
        tt = parseFloat(result.testDuration);
      }
      if (result.incompleteTestSeconds != undefined) {
        tt += result.incompleteTestSeconds;
      } else if (result.restartCount != undefined && result.restartCount > 0) {
        tt += (tt / 4) * result.restartCount;
      }
      totalSeconds += tt;

      // console.log(result);
      //apply filters
      let resdiff = result.difficulty;
      if (resdiff == undefined) {
        resdiff = "normal";
      }
      // if (!activeFilters.includes("difficulty_" + resdiff)) return;
      if (!config.resultFilters.difficulty[resdiff]) return;
      // if (!activeFilters.includes("mode_" + result.mode)) return;
      if (!config.resultFilters.mode[result.mode]) return;

      if (result.mode == "time") {
        let timefilter = "custom";
        if ([15, 30, 60, 120].includes(parseInt(result.mode2))) {
          timefilter = result.mode2;
        }
        // if (!activeFilters.includes(timefilter)) return;
        if (!config.resultFilters.time[timefilter]) return;
      } else if (result.mode == "words") {
        let wordfilter = "custom";
        if ([10, 25, 50, 100, 200].includes(parseInt(result.mode2))) {
          wordfilter = result.mode2;
        }
        // if (!activeFilters.includes(wordfilter)) return;
        if (!config.resultFilters.words[wordfilter]) return;
      }

      // if (!activeFilters.includes("lang_" + result.language)) return;
      if (!config.resultFilters.language[result.language]) return;

      let puncfilter = "off";
      if (result.punctuation) {
        puncfilter = "on";
      }
      if (!config.resultFilters.punctuation[puncfilter]) return;
      // if (!activeFilters.includes(puncfilter)) return;

      if (result.funbox === "none" || result.funbox === undefined) {
        // if (!activeFilters.includes("funbox_none")) return;
        if (!config.resultFilters.funbox.none) return;
      } else {
        // if (!activeFilters.includes("funbox_" + result.funbox)) return;
        if (!config.resultFilters.funbox[result.funbox]) return;
      }

      let tagHide = true;

      if (result.tags === undefined || result.tags.length === 0) {
        //no tags, show when no tag is enabled
        if (dbSnapshot.tags.length > 0) {
          // if (activeFilters.includes("tag_notag")) tagHide = false;
          if (config.resultFilters.tags.none) tagHide = false;
        } else {
          tagHide = false;
        }
      } else {
        //tags exist
        let validTags = dbSnapshot.tags.map((t) => t.id);
        result.tags.forEach((tag) => {
          //check if i even need to check tags anymore
          if (!tagHide) return;
          //check if tag is valid
          if (validTags.includes(tag)) {
            //tag valid, check if filter is on
            // if (activeFilters.includes("tag_" + tag)) tagHide = false;
            if (config.resultFilters.tags[tag]) tagHide = false;
          }
        });
      }

      if (tagHide) return;

      let timeSinceTest = Math.abs(result.timestamp - Date.now()) / 1000;

      let datehide = true;

      // if (
      //   activeFilters.includes("date_all") ||
      //   (activeFilters.includes("date_day") && timeSinceTest <= 86400) ||
      //   (activeFilters.includes("date_week") && timeSinceTest <= 604800) ||
      //   (activeFilters.includes("date_month") && timeSinceTest <= 18144000)
      // ) {
      //   datehide = false;
      // }

      if (
        config.resultFilters.date.all ||
        (config.resultFilters.date.last_day && timeSinceTest <= 86400) ||
        (config.resultFilters.date.last_week && timeSinceTest <= 604800) ||
        (config.resultFilters.date.last_month && timeSinceTest <= 18144000)
      ) {
        datehide = false;
      }

      if (datehide) return;

      filteredResults.push(result);

      //filters done
      //=======================================

      tt = 0;
      if (result.testDuration == undefined) {
        //test finished before testDuration field was introduced - estimate
        if (result.mode == "time") {
          tt = parseFloat(result.mode2);
        } else if (result.mode == "words") {
          tt = (parseFloat(result.mode2) / parseFloat(result.wpm)) * 60;
        }
      } else {
        tt = parseFloat(result.testDuration);
      }
      if (result.incompleteTestSeconds != undefined) {
        tt += result.incompleteTestSeconds;
      } else if (result.restartCount != undefined && result.restartCount > 0) {
        tt += (tt / 4) * result.restartCount;
      }
      totalSecondsFiltered += tt;

      if (last10 < 10) {
        last10++;
        wpmLast10total += result.wpm;
        totalAcc10 += result.acc;
        result.consistency !== undefined
          ? (totalCons10 += result.consistency)
          : 0;
      }
      testCount++;

      if (result.consistency !== undefined) {
        consCount++;
        totalCons += result.consistency;
      }

      if (result.rawWpm != null) {
        if (rawWpm.last10Count < 10) {
          rawWpm.last10Count++;
          rawWpm.last10Total += result.rawWpm;
        }
        rawWpm.total += result.rawWpm;
        rawWpm.count++;
        if (result.rawWpm > rawWpm.max) {
          rawWpm.max = result.rawWpm;
        }
      }

      totalAcc += result.acc;

      if (result.restartCount != undefined) {
        testRestarts += result.restartCount;
      }

      chartData.push({
        x: result.timestamp,
        y: result.wpm,
        acc: result.acc,
        mode: result.mode,
        mode2: result.mode2,
        punctuation: result.punctuation,
        language: result.language,
        timestamp: result.timestamp,
        difficulty: result.difficulty,
      });

      if (result.wpm > topWpm) {
        let puncsctring = result.punctuation ? ",<br>with punctuation" : "";
        topWpm = result.wpm;
        topMode = result.mode + " " + result.mode2 + puncsctring;
      }

      totalWpm += result.wpm;
    });
    loadMoreLines();
    ////////

    resultHistoryChart.options.scales.xAxes[0].ticks.minor.fontColor =
      themeColors.sub;
    resultHistoryChart.options.scales.yAxes[0].ticks.minor.fontColor =
      themeColors.sub;
    resultHistoryChart.data.datasets[0].borderColor = themeColors.main;
    resultHistoryChart.options.legend.labels.fontColor = themeColors.sub;
    resultHistoryChart.data.datasets[0].trendlineLinear.style = themeColors.sub;

    resultHistoryChart.data.datasets[0].data = chartData;

    if (chartData == [] || chartData.length == 0) {
      $(".pageAccount .group.noDataError").removeClass("hidden");
      $(".pageAccount .group.chart").addClass("hidden");
      $(".pageAccount .group.history").addClass("hidden");
      $(".pageAccount .triplegroup.stats").addClass("hidden");
    } else {
      $(".pageAccount .group.noDataError").addClass("hidden");
      $(".pageAccount .group.chart").removeClass("hidden");
      $(".pageAccount .group.history").removeClass("hidden");
      $(".pageAccount .triplegroup.stats").removeClass("hidden");
    }

    // moment
    //   .utc(moment.duration(totalSeconds, "seconds").asMilliseconds())
    //   .format("HH:mm:ss")
    let th = Math.floor(totalSeconds / 3600);
    let tm = Math.floor((totalSeconds % 3600) / 60);
    let ts = Math.floor((totalSeconds % 3600) % 60);
    $(".pageAccount .timeTotal .val").text(`
      
      ${th < 10 ? "0" + th : th}:${tm < 10 ? "0" + tm : tm}:${
      ts < 10 ? "0" + ts : ts
    }
    `);
    //moment
    // .utc(moment.duration(totalSecondsFiltered, "seconds").asMilliseconds())
    // .format("HH:mm:ss")
    let tfh = Math.floor(totalSecondsFiltered / 3600);
    let tfm = Math.floor((totalSecondsFiltered % 3600) / 60);
    let tfs = Math.floor((totalSecondsFiltered % 3600) % 60);
    $(".pageAccount .timeTotalFiltered .val").text(`
      
    ${tfh < 10 ? "0" + tfh : tfh}:${tfm < 10 ? "0" + tfm : tfm}:${
      tfs < 10 ? "0" + tfs : tfs
    }
  `);

    $(".pageAccount .highestWpm .val").text(topWpm);
    $(".pageAccount .averageWpm .val").text(Math.round(totalWpm / testCount));
    $(".pageAccount .averageWpm10 .val").text(
      Math.round(wpmLast10total / last10)
    );

    $(".pageAccount .highestRaw .val").text(rawWpm.max);
    $(".pageAccount .averageRaw .val").text(
      Math.round(rawWpm.total / rawWpm.count)
    );
    $(".pageAccount .averageRaw10 .val").text(
      Math.round(rawWpm.last10Total / rawWpm.last10Count)
    );

    $(".pageAccount .highestWpm .mode").html(topMode);
    $(".pageAccount .testsTaken .val").text(testCount);

    $(".pageAccount .avgAcc .val").text(Math.round(totalAcc / testCount) + "%");
    $(".pageAccount .avgAcc10 .val").text(
      Math.round(totalAcc10 / last10) + "%"
    );

    // console.log(totalCons10);
    // console.log(last10);

    if (totalCons == 0 || totalCons == undefined) {
      $(".pageAccount .avgCons .val").text("-");
      $(".pageAccount .avgCons10 .val").text("-");
    } else {
      $(".pageAccount .avgCons .val").text(
        Math.round(totalCons / consCount) + "%"
      );
      $(".pageAccount .avgCons10 .val").text(
        Math.round(totalCons10 / Math.min(last10, consCount)) + "%"
      );
    }

    $(".pageAccount .testsStarted .val").text(`${testCount + testRestarts}`);

    $(".pageAccount .testsCompleted .val").text(
      `${testCount}(${Math.floor(
        (testCount / (testCount + testRestarts)) * 100
      )}%)`
    );

    $(".pageAccount .avgRestart .val").text(
      (testRestarts / testCount).toFixed(1)
    );

    // if(testCount == 0){
    //   $('.pageAccount .group.chart').fadeOut(125);
    //   $('.pageAccount .triplegroup.stats').fadeOut(125);
    //   $('.pageAccount .group.history').fadeOut(125);
    // }else{
    //   $('.pageAccount .group.chart').fadeIn(125);
    //   $('.pageAccount .triplegroup.stats').fadeIn(125);
    //   $('.pageAccount .group.history').fadeIn(125);
    // }

    // let favMode = testModes.words10;
    // let favModeName = 'words10';
    // $.each(testModes, (key, mode) => {
    //   if (mode.length > favMode.length) {
    //     favMode = mode;
    //     favModeName = key;
    //   }
    // })
    // if (favModeName == 'words10' && testModes.words10.length == 0) {
    //   //new user
    //   $(".pageAccount .favouriteTest .val").text(`-`);
    // } else {
    //   $(".pageAccount .favouriteTest .val").text(`${favModeName} (${Math.floor((favMode.length/testCount) * 100)}%)`);
    // }

    if (resultHistoryChart.data.datasets[0].length > 0) {
      resultHistoryChart.options.plugins.trendlineLinear = true;
    } else {
      resultHistoryChart.options.plugins.trendlineLinear = false;
    }

    let wpmPoints = filteredResults.map((r) => r.wpm).reverse();

    let trend = findLineByLeastSquares(wpmPoints);

    let slope = calculateSlope(trend);
    let plus = slope > 0 ? "+" : "";

    $(".pageAccount .group.chart .below").text(
      `Trend slope: ${plus + roundTo2(slope)}`
    );

    resultHistoryChart.update({ duration: 0 });

    swapElements($(".pageAccount .preloader"), $(".pageAccount .content"), 250);
  }

  if (dbSnapshot === null) {
    // console.log('no db snap');
    // db_getUserResults().then(data => {
    //   if(!data) return;
    //   dbSnapshot = data;
    //   cont();
    // })
  } else {
    // console.log('using db snap');
    cont();
  }
}

function showResultEditTagsPanel() {
  if ($("#resultEditTagsPanelWrapper").hasClass("hidden")) {
    $("#resultEditTagsPanelWrapper")
      .stop(true, true)
      .css("opacity", 0)
      .removeClass("hidden")
      .animate({ opacity: 1 }, 125);
  }
}

function hideResultEditTagsPanel() {
  if (!$("#resultEditTagsPanelWrapper").hasClass("hidden")) {
    $("#resultEditTagsPanelWrapper")
      .stop(true, true)
      .css("opacity", 1)
      .animate(
        {
          opacity: 0,
        },
        100,
        (e) => {
          $("#resultEditTagsPanelWrapper").addClass("hidden");
        }
      );
  }
}

$(document).on("click", ".pageAccount .group.history #resultEditTags", (f) => {
  if (dbSnapshot.tags.length > 0) {
    let resultid = $(f.target).parents("span").attr("resultid");
    let tags = $(f.target).parents("span").attr("tags");
    $("#resultEditTagsPanel").attr("resultid", resultid);
    $("#resultEditTagsPanel").attr("tags", tags);
    updateActiveResultEditTagsPanelButtons(JSON.parse(tags));
    showResultEditTagsPanel();
  }
});

$(document).on("click", "#resultEditTagsPanelWrapper .button.tag", (f) => {
  $(f.target).toggleClass("active");
});

$("#resultEditTagsPanelWrapper").click((e) => {
  if ($(e.target).attr("id") === "resultEditTagsPanelWrapper") {
    hideResultEditTagsPanel();
  }
});

function updateResultEditTagsPanelButtons() {
  $("#resultEditTagsPanel .buttons").empty();
  dbSnapshot.tags.forEach((tag) => {
    $("#resultEditTagsPanel .buttons").append(
      `<div class="button tag" tagid="${tag.id}">${tag.name}</div>`
    );
  });
}

function updateActiveResultEditTagsPanelButtons(active) {
  if (active === []) return;
  $.each($("#resultEditTagsPanel .buttons .button"), (index, obj) => {
    let tagid = $(obj).attr("tagid");
    if (active.includes(tagid)) {
      $(obj).addClass("active");
    } else {
      $(obj).removeClass("active");
    }
    // active.forEach(activetagid => {
    //   if(activetagid === tagid){
    //     $(obj).addClass('active');
    //   }else{
    //     $(obj).removeClass('active');
    //   }
    // })
  });
}

$("#resultEditTagsPanel .confirmButton").click((f) => {
  let resultid = $("#resultEditTagsPanel").attr("resultid");
  let oldtags = JSON.parse($("#resultEditTagsPanel").attr("tags"));

  let newtags = [];
  $.each($("#resultEditTagsPanel .buttons .button"), (index, obj) => {
    let tagid = $(obj).attr("tagid");
    if ($(obj).hasClass("active")) {
      newtags.push(tagid);
    }
  });
  showBackgroundLoader();
  hideResultEditTagsPanel();
  updateResultTags({
    uid: firebase.auth().currentUser.uid,
    tags: newtags,
    resultid: resultid,
  }).then((r) => {
    hideBackgroundLoader();
    if (r.data.resultCode === 1) {
      showNotification("Tags updated", 1000);
      dbSnapshot.results.forEach((result) => {
        if (result.id === resultid) {
          result.tags = newtags;
        }
      });
      refreshAccountPage();
    } else {
      showNotification("Error updating tags", 3000);
    }
  });
});
