"use strict;"

// Constants
const apiBaseURL = "http://62.217.127.19:8010";
const apiMovieSearch = apiBaseURL + "/movie";
const apiMovieRatings = apiBaseURL + "/ratings";
const ratedMovies = new Map();

// keep a ref to the page navigator class instance
let pageNavigation = null;

/**
 * JSDoc definition of Movie object
 * @typedef Movie
 * @type {object}
 * @property {number} movieId
 * @property {string} title
 * @property {string} genres
 * @property {?number} rating
 */

/**
 * Return a Promise that sleeps for the supplied
 * number of milliseconds
 * @param {Number} ms 
 * @returns {Promise}
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate the pearson correlation factor between 
 * two arrays of ratings
 * @param {Object} movieratings1 
 * @param {Object} movieratings2 
 * @returns {Number}
 */
function pearsonCorrelation(movieratings1, movieratings2) {

    const commonKeys = Array.from(Object.keys(movieratings1)).filter((key) => {
        return Object.keys(movieratings2).indexOf(key) !== -1
    })

    const n = commonKeys.length
    if (n === 0) {
        return 0;
    }

    let d1 = commonKeys.map((key) => { return movieratings1[key] });
    let d2 = commonKeys.map((key) => { return movieratings2[key] });
    
    let { pow, sqrt } = Math;
    let add = (a, b) => a + b;
    let [sum1, sum2] = [d1, d2].map((l) => l.reduce(add));
    let [pow1, pow2] = [d1, d2].map((l) => l.reduce((a, b) => a + pow(b, 2), 0));
    let mulSum = d1.map((n, i) => n * d2[i]).reduce(add);
    let dense = sqrt((pow1 - pow(sum1, 2) / n) * (pow2 - pow(sum2, 2) / n));
    
    if (dense === 0) {
        return 0;
    }

    return (mulSum - (sum1 * sum2) / n) / dense;
}

/**
 * smooths out certain inconsistencies of API movies entries.
 * e.g. title starting with " and falling into genres as well.
 * @param {Movie} movie 
 * @returns {Boolean}
 */
function fixBadAPIMovieEntries(movie) {

    let titleLength = movie.title.length 
    if (movie.title == null || titleLength == 0) {
        return false;
    }

    if (movie.title[0] == "\"" && movie.title[titleLength-1] != "\"") {
        movie.title = movie.title.slice(1, titleLength) + movie.genres
        titleLength = movie.title.length 
        if (movie.title[titleLength - 1] == "\"") {
            movie.title = movie.title.slice(0, titleLength-1)
        }
        movie.genres = "(no genres listed)"
    }

    return movie
}

/**
 * Sets the innerHTML of the element only if it is different
 * than the supplied innerHTML
 * @param {Element} element 
 * @param {string} innerHTML 
 */
function setInnerHTMLIfDifferent(element, innerHTML) {
    if (element.innerHTML != innerHTML) {
        element.innerHTML = innerHTML;
    }
}

/**
 * Presents the message of the supplied error in the page
 * snackbar
 * @param {Error} error 
 */
function ShowError(error) {
    const snackBarElement = document.getElementById("snackbar");
    snackBarElement.className = "show";
    snackBarElement.textContent = error.message;
    setTimeout(function () { snackBarElement.className = snackBarElement.className.replace("show", ""); }, 3000);
}

/**
 * Fired when a user clears the rating of a movie
 * @param {Element} e 
 * @returns {null}
 */
function MovieUnRated(e) {
    const movieId = parseInt(e.getAttribute("data-id"));
    if (movieId == null) {
        return;
    }

    // don't show the clear rating button in popup
    document.querySelector(`#popup-${movieId} > div`).classList.add("disp-none");

    // update position of rating popup
    const popupElement = document.querySelector(`#popup-${movieId}`);
    popupElement.classList.add("popuptext-without-clear");
    popupElement.classList.remove("popuptext-with-clear");

    // clear the text of the span that shows the user rating
    document.querySelector(`#rating-span-${movieId}`).textContent = "";

    // make the rate icon show the add icon
    const rateIconElement = document.querySelector(`#movie-${movieId} .rate-button > i`);
    rateIconElement.classList.add("mdi-star-plus");
    rateIconElement.classList.remove("mdi-star-check");

    // clear the radio buttons
    document.querySelector(`#movie-${movieId} .rate > input:checked`).checked = false;

    // remove the movie from the user rated movies map
    ratedMovies.delete(movieId);

    // if user is on the home page trigger a reload
    pageNavigation.TriggerReload("home");
}

/**
 * Fired when a user rates a movie
 * @param {Element} e 
 * @returns {null}
 */
function MovieRated(e) {
    if (e == null) {
        return;
    }

    // check that element called this function has the attributes 
    // "data-id" and "value"
    const movieId = parseInt(e.getAttribute("data-id"));
    if (movieId == null) {
        return;
    }

    let ratingValue = parseInt(e.getAttribute("value"));
    if (ratingValue == null) {
        return;
    }

    // scale rating to 0-5
    ratingValue = ratingValue / 2.0;

    // show the user rating in the span
    document.querySelector(`#rating-span-${movieId}`).textContent = ratingValue.toLocaleString();

    // make the rate icon show the checked icon
    const rateIconElement = document.querySelector(`#movie-${movieId} .rate-button > i`);
    rateIconElement.classList.remove("mdi-star-plus");
    rateIconElement.classList.add("mdi-star-check");

    // show the clear rating button in popup
    document.querySelector(`#popup-${movieId} > div`).classList.remove("disp-none");

    // update position of rating popup
    const popupElement = document.querySelector(`#popup-${movieId}`);
    popupElement.classList.remove("popuptext-without-clear");
    popupElement.classList.add("popuptext-with-clear");

    // get movie title
    const movieItemElement = document.querySelector(`#movie-${movieId}`);
    const movieTitle = movieItemElement.querySelector(`.movie-title > p`).textContent;

    // get all movie genres
    const movieGenres = [];
    movieItemElement.querySelectorAll('.movie-genres > span').forEach((val) => {
        movieGenres.push(val.textContent);
    });


    // fill ratedMovies with this movie
    ratedMovies.set(movieId, {
        movieId: movieId,
        rating: ratingValue,
        title: movieTitle,
        genres: movieGenres.join("|"),
    })
}

/**
 * 
 * @param {Movie} movie 
 * @returns {String}
 */
function getMovieItemHTML(movie) {

    // get the html of genres
    const genresHTML = movie.genres.split("|").map((item) => {
        return `<span class="genre-item">${item}</span>`
    }).join("\n");

    // initialize variables as there is no user rating 
    // for this movie
    let userRatingText = '';
    let ratingIconClass = "mdi-star-plus";
    let unratedIconClass = "disp-none";
    let popupTextClass = "popuptext-without-clear";

    // check if there is a user rating for this movie
    // and set the above variables appropriately
    const userRating = ratedMovies.get(movie.movieId);
    if (userRating !== undefined) {
        userRatingText = userRating.rating.toLocaleString();
        ratingIconClass = "mdi-star-check";
        unratedIconClass = "";
        popupTextClass = "popuptext-with-clear";
    }

    // build the HTML for the rating popup
    let starRatingsHTML = "";
    for (let i = 10; i > 0; i--) {
        const rating = (i / 2.0);
        const ratingText = rating.toLocaleString();

        // make the radiobutton that corresponds to 
        // the user rating be checked
        let inputCheckedClass = "";
        if (userRating !== undefined) {
            if (rating === userRating.rating) {
                inputCheckedClass = "checked";
            }
        }

        let halfStarClass = `class="half"`
        if (i % 2 == 0) {
            halfStarClass = "";
        }

        starRatingsHTML += `<input type="radio" id="${movie.movieId}-rating${i}" onclick="MovieRated(this)" 
        name="${movie.movieId}" value="${i}" data-id="${movie.movieId}" ${inputCheckedClass}/>
        <label ${halfStarClass} for="${movie.movieId}-rating${i}" title="${ratingText} stars"></label>\n`
    }

    // return html of the movie-item
    return `\n<div class="movie" id="movie-${movie.movieId}">
        <div class="movie-left">
            <i class="mdi mdi-movie mdi-36px"></i>
        </div>
        <div class="movie-right">
            <div class="movie-title">
                <p>${movie.title}</p>
            </div>
            <div class="movie-genres">
                ${genresHTML}
            </div>
            <div class="popup" onclick="ShowRatingPopup(this)" data-value="popup-${movie.movieId}">
                <div class="rate-button">
                    <span id="rating-span-${movie.movieId}">${userRatingText}</span>
                    <i class="mdi ${ratingIconClass} mdi-24px"></i>
                </div>
                <span class="${popupTextClass} popuptext" id="popup-${movie.movieId}">
                    <div class=" ${unratedIconClass}" data-id="${movie.movieId}" onclick="MovieUnRated(this)">
                        <i class="mdi mdi-star-remove mdi-20px"></i>
                    </div>
                    <fieldset class="rate">
                        ${starRatingsHTML}
                    </fieldset>
                </span>
            </div>
        </div>
    </div>\n`;
}

/**
 * Helper function to make visible the respective
 * popup of rating stars for a movie item
 * @param {Element} e 
 */
function ShowRatingPopup(e) {
    if (e == null) {
        return;
    }

    const popup = document.getElementById(e.getAttribute("data-value"));
    if (popup === null) {
        return;
    }

    popup.classList.toggle("popupshow");
}

/**
 * Helper function to POST json data to the supplied url
 * @param {String} url 
 * @param {Object} data 
 * @returns {Promise}
 */
async function HTTPPost(url = '', data = {}) {
    const response = await fetch(url, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        },
        redirect: 'error', // security reasons
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(data)
    });

    if (response.status != 200) {
        throw new Error(`Bad HTTP Status ${response.status}`);
    }

    return response.json();
}

/**
 * Helper function function to GET the supplied url
 * @param {String} url 
 * @returns {Promise}
 */
async function HTTPGet(url) {
    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        redirect: 'error', // security reasons
        referrerPolicy: 'no-referrer',
    });

    if (response.status != 200) {
        throw new Error(`Bad HTTP Status ${response.status}`);
    }

    return response.json();
}

/** Class representing a Page in our app */
class Page {

    /**
     * Create a page.
     * @param {String} pageId 
     */
    constructor(pageId) {
        this.pageId = pageId
    }

    /**
     * Load the Page; user navigated to this Page.
     * @param {Element} contentElement 
     */
    Load(contentElement) {
        throw new Error('unimplemented');
    }

    /**
     * Unload the Page; user navigated to a different Page
     * than this one.
     */
    UnLoad() {
        throw new Error('unimplemented');
    }
}

/** Home page class */
class HomePage extends Page {
    constructor() {
        super("home")
    }

    /**
     * Get the HTML code to show to the user that he hasn't 
     * rate any movies
     * @returns {String}
     */
    NoRatedMoviesHTML() {
        return `<div class="movie-search flex-full-row">
            <i class="mdi mdi-movie-open-star mdi-48px"></i>
            <p>Go to search and rate movies</p>
        </div>`;
    }

    /**
     * Get the HTML code that represents the header which is above
     * the rated movies of the user.
     * @returns {String}
     */
    getMovieItemsHeader() {
        return `<div class="list-header flex-full-row">
            Your movie ratings
        </div>`;
    }

    Load(contentElement) {
        console.log("Home Page - Load");
        contentElement.innerHTML = `<div class="movie-list-cont flex-grow"></div>`

        const movieListElement = document.querySelector('.movie-list-cont');
        if (movieListElement == null) {
            throw new Error("can't find movie list container element");
        }

        if (ratedMovies.size == 0) {
            movieListElement.innerHTML = this.NoRatedMoviesHTML();
            return;
        }

        movieListElement.classList.remove("flex-grow")

        let innerHTML = this.getMovieItemsHeader(ratedMovies.size);
        for (let key of ratedMovies.keys()) {
            innerHTML += getMovieItemHTML(ratedMovies.get(key));
        }

        movieListElement.innerHTML = innerHTML;
    }

    UnLoad() {
        console.log("Home Page - Unload");
    }
}

/** Search page class */
class SearchPage extends Page {

    // batch size of movie items to render
    // NOTE: if we render them all together
    //       our browser window may freeze
    movieListPagingSize = 100;
    // artificial delay of hitting the API when 
    // user types
    searchTypeDelay = 1000;

    // function to get notified when an element
    // becomes visible in the screen
    respondToVisibility = function (element, callback) {
        var options = {
            root: document.documentElement,
        };

        var observer = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                callback(entry.intersectionRatio > 0);
            });
        }, options);

        observer.observe(element);
    };

    constructor() {
        super("search");
        this.moviesSearchChunks = [];
    }

    /**
     * Get the HTML code to show to the user that he needs 
     * to type in the input textbox to search for movies
     * @returns {String}
     */
    SearchTypeHTML() {
        return `<div class="movie-search flex-full-row">
            <i class="mdi mdi-search-web mdi-48px"></i>
            <p>Start typing above to search movies</p>
        </div>`;
    }

    /**
     * Get the HTML code to show to the user that his search
     * term has no results
     * @returns {String}
     */
    SearchNoResultsHTML(searchTerm) {
        return `<div class="movie-search flex-full-row">
            <i class="mdi mdi-alert-circle-outline mdi-48px"></i>
            <p>No movies found for "${searchTerm}"</p>
        </div>`;
    }

    /**
     * Get the HTML code to show to the user that a search 
     * is ongoing
     * @returns {String}
     */
    SearchMoviesInProgressHTML(searchTerm) {
        return `<div class="movie-search flex-full-row">
            <div class="loader"></div>
        </div>`;
    }

    /**
     * Get the HTML code that represents the header which is above
     * the movies items returned from the user search.
     * @param {Number} moviesLength 
     * @param {String} searchTerm 
     * @returns {String}
     */
    getMovieItemsHeader(moviesLength, searchTerm) {

        let text = `Found ${moviesLength} movies that contain "${searchTerm}"`
        if (moviesLength === 1) {
            text = `Found ${moviesLength} movie that contains "${searchTerm}"`
        }

        return `<div class="list-header flex-full-row">
            ${text}
        </div>`;
    }

    /**
     * Get the HTML code for the loader item
     * @param {Number} index 
     * @returns 
     */
    getMovieListLoader(index) {
        return `<div id="loader-${index}" class="movie-loader" data-value="${index}">
            <div class="loader"></div>
        </div>`
    }

    /**
     * Get the HTML code for all the movie items that belong in
     * the batch with the supplied index. If there is a next batch 
     * available, a loader item will be in the HTML code after the 
     * respective movie items
     * @param {Number} index 
     * @returns {String}
     */
    getMoviesBatchHTML(index) {
        let innerHTML = '';

        if (index >= this.moviesSearchChunks.length) {
            return '';
        }

        this.moviesSearchChunks[index].forEach(movie => {
            innerHTML += getMovieItemHTML(movie);
        });

        if (index + 1 >= this.moviesSearchChunks.length) {
            return innerHTML;
        }

        innerHTML += this.getMovieListLoader(index);

        return innerHTML;
    }

    /**
     * Sets up the appropriate events for newly created 
     * movie batch loader items (when they become visible 
     * in the browser window) and removes the old ones
     * @returns {null}
     */
    setupMovieBatchLoaderEvent() {
        const loaderElement = document.querySelector(`.movie-loader`)
        const movieListElement = document.querySelector('.movie-list-cont');

        if (loaderElement == null || movieListElement == null) {
            return;
        }

        this.respondToVisibility(loaderElement, (visible) => {
            if (visible) {

                sleep(500).then(() => {

                    const index = parseInt(loaderElement.getAttribute("data-value"));
                    if (movieListElement == null) {
                        return
                    }

                    loaderElement.remove();

                    movieListElement.innerHTML += this.getMoviesBatchHTML(index + 1);
                    this.setupMovieBatchLoaderEvent();
                }
                );
            }
        });
    }

    Load(contentElement) {
        console.log("Search Page - Load");

        contentElement.innerHTML = `<div class="movie-search-cont">
            <input type="search" placeholder="type to search movies" id="site-search" name="q" aria-label="Search through site content">
        </div>
        <div class="movie-list-cont flex-grow"></div>
        `

        const searchElement = document.querySelector('#site-search');
        if (searchElement == null) {
            throw new Error("can't find search input element");
        }

        const movieListElement = document.querySelector('.movie-list-cont');
        if (movieListElement == null) {
            throw new Error("can't find movie list container element");
        }

        // show the default movie list 
        movieListElement.innerHTML = this.SearchTypeHTML();

        // capture key presses in the search text box
        let userTypingTimeout = null;
        searchElement.addEventListener('input', (e) => {
            // clear any pending API searches
            clearTimeout(userTypingTimeout);
            this.moviesSearchChunks = null;
            this.moviesSearchChunks = [];
            const searchValueBeforeSearch = searchElement.value.trim();

            // if the value is empty don't invoke the timer
            // and clear all data in memory
            if (searchValueBeforeSearch == '') {
                setInnerHTMLIfDifferent(movieListElement, this.SearchTypeHTML());
                movieListElement.classList.add("flex-grow")
                return;
            }

            // show a continuos loader so the user knows 
            // that something is happening
            setInnerHTMLIfDifferent(movieListElement, this.SearchMoviesInProgressHTML());
            movieListElement.classList.add("flex-grow")

            // fire an API search in 1 sec from now and thus give 
            // some time to the user to finish typing
            userTypingTimeout = setTimeout(() => {

                // if by the time this is invoked the user has changed
                // search term don't hit the API
                const searchValueCurrent = searchElement.value.trim();
                if (searchValueCurrent != searchValueBeforeSearch) {
                    this.moviesSearchChunks = null;
                    this.moviesSearchChunks = [];
                    return
                }

                // Hit the API
                HTTPPost(apiMovieSearch, { keyword: searchValueCurrent })
                    .then(data => {

                        this.moviesSearchChunks = null;
                        this.moviesSearchChunks = [];

                        // if by the time the API responded the user has changed
                        // do nothing
                        const searchValueCurrent = searchElement.value.trim();
                        if (searchValueCurrent != searchValueBeforeSearch) {
                            return
                        }

                        data = data.map(fixBadAPIMovieEntries);

                        const dataLength = data.length;
                        if (dataLength == 0) {
                            movieListElement.innerHTML = this.SearchNoResultsHTML(searchValueCurrent);
                            movieListElement.classList.add("flex-grow");
                            return;
                        }
                        // split results in chunks and thus be able to render them
                        // more efficiently
                        const movieSearchPagingSize = this.movieListPagingSize;

                        for (let i = 0; i < data.length; i += movieSearchPagingSize) {
                            const moviesSearchChunk = data.slice(i, i + movieSearchPagingSize);
                            this.moviesSearchChunks.push(moviesSearchChunk);
                        }

                        const innerHTML = this.getMovieItemsHeader(dataLength, searchValueCurrent) + this.getMoviesBatchHTML(0);
                        movieListElement.innerHTML = innerHTML;
                        movieListElement.classList.remove("flex-grow")
                        this.setupMovieBatchLoaderEvent();
                        movieListElement.scrollTop = 0;

                    }).catch(reason => {
                        ShowError(reason);
                        this.moviesSearchChunks = null;
                        this.moviesSearchChunks = [];
                        movieListElement.innerHTML = this.SearchTypeHTML();
                        movieListElement.classList.add("flex-grow");
                    });
            }, this.searchTypeDelay);
        });

        // detect clicks in the window
        window.onclick = function (event) {
            // find shown popups
            const shownPopups = document.getElementsByClassName("popuptext popupshow")

            for (let i = 0; i < shownPopups.length; i++) {
                const shownPopup = shownPopups.item(i);
                // check if shown popup is caused from this event
                if (event.target != shownPopup && event.target.parentElement != shownPopup.previousElementSibling) {
                    shownPopup.classList.toggle("popupshow");
                }
            }
        }
    }

    UnLoad() {
        console.log("Search Page - Unload");
    }
}

/** Recommendations page class */
class RecommendationsPage extends Page {
    constructor() {
        super("recommendations")
    }
    /**
     * Get the HTML code that represents the header which is above
     * the rated movies of the user.
     * @returns {String}
     */
    getHeader() {
        return `<div class="list-header flex-full-row">
            We recommend for you
        </div>`;
    }
    getRecommendationsNotFoundHTML() {
        return `<div class="movie-search flex-full-row">
            <i class="mdi mdi-movie-open-star mdi-48px"></i>
            <p>Recommendations not found yet. Go to search and rate movies</p>
        </div>`;
    }

    RecommendMoviesInProgressHTML() {
        return `<div class="movie-search flex-full-row">
            <div class="loader"></div>
        </div>`;
    }

    Load(contentElement) {
        console.log("Recommendations Page - Load");
        contentElement.innerHTML = `<div class="movie-list-cont flex-grow"></div>`

        const movieListElement = document.querySelector(".movie-list-cont");
        if (movieListElement == null) {
            throw new Error("can't find movie list container element");
        }

        // if local user hasn't rated any movies yet
        // show the respective message
        if (ratedMovies.size == 0) {
            movieListElement.innerHTML = this.getRecommendationsNotFoundHTML();
            return;
        }

        // show loading screen
        movieListElement.innerHTML = this.RecommendMoviesInProgressHTML();

        const localUserRatings = {};
        Array.from(ratedMovies.values()).forEach((item) => {
            localUserRatings[item.movieId] = item.rating;
        });

        // construct the network payload
        const payload = Array.from(ratedMovies.keys());

        // Hit the API
        HTTPPost(apiMovieRatings, { movieList: payload }).then(async (allMovieRatings) => {
            
            // transform the API data to a more convenient 
            // data structure
            // { userId: { movieId1: rating1, movieId2: rating2, ...}, ...}
            const otherUsersRatingsPerUserId = {};
            allMovieRatings.forEach((allUsersMovieRatings) => {
                allUsersMovieRatings.forEach((otherUserRating) => {
                    const userId = otherUserRating.userId.toString();

                    if (otherUsersRatingsPerUserId[userId] === undefined) {
                        otherUsersRatingsPerUserId[userId] = {};
                    }

                    otherUsersRatingsPerUserId[userId][otherUserRating.movieId] = otherUserRating.rating;
                });
            });

            const otherUsersPearsonScores = Array.from(Object.keys(otherUsersRatingsPerUserId))
                .map((userId) => {
                    return {
                        factor: pearsonCorrelation(localUserRatings, otherUsersRatingsPerUserId[userId]),
                        userId: userId
                    }
                })
                .sort((user1, user2) => {
                    return user2.factor - user1.factor;
                });

            // if the otherUsersPearsonScores is empty or we can't find a user with 
            // high corelation factor show the respective message
            if (otherUsersPearsonScores.length == 0 || otherUsersPearsonScores[0].factor < 0.75) {
                movieListElement.classList.add("flex-grow");
                movieListElement.innerHTML = this.getRecommendationsNotFoundHTML();
                return;
            }

            // Get the rated movies of bestMatch user
            const bestMatchOtherUserId = otherUsersPearsonScores[0].userId;
            const bestUserRatedMovies = await HTTPGet(apiMovieRatings + `/${bestMatchOtherUserId}`)

            // Get the details of each movie 
            const recommendedMoviesLimit = 40;
            const bestMatchUserAllMovieDetails = await Promise.all(
                // filter out movies that the other user has rated low 
                // and our user has already rated/seen
                bestUserRatedMovies.filter((movieRatedByUser) => {
                    return (movieRatedByUser.rating >= 4.0 && ratedMovies.get(movieRatedByUser.movieId) === undefined)
                })
                .slice(0, recommendedMoviesLimit)
                .map((movieRatedByUser) => {
                    return HTTPGet(apiMovieSearch + `/${movieRatedByUser.movieId}`);
                })
            )

            // if we can't get the details for any movie rated by the user
            // show the respective message
            if (bestMatchUserAllMovieDetails.length == 0) {
                movieListElement.classList.add("flex-grow");
                movieListElement.innerHTML = this.getRecommendationsNotFoundHTML();
                return;
            }

            // construct the HTML for the movieListElement
            const innerHTML = this.getHeader() + bestMatchUserAllMovieDetails
                .map((movie) => { return getMovieItemHTML(fixBadAPIMovieEntries(movie[0])) })
                .join("\n")

            movieListElement.innerHTML = innerHTML;
            movieListElement.classList.remove("flex-grow");

        }).catch((reason) => {
            ShowError(reason);
        });
    }

    UnLoad() {
        console.log("Recommendations Page - Unload");
    }
}

/** 
 * Page navigation class is a helper class to 
 * navigate between different Pages in our web
 * application
 */
class PageNavigation {

    /**
     * Create a Page navigation class. 
     * @param {Element} contentElement - Element that each Page will redraw when it Loads
     * @param {String} defaultPage - the ID of the Page to load initially
     * @param  {...Element} navigationElements - Elements that they bear the data-target 
     * attribute with a value that match the ID of a Page
     * @returns {null}
     */
    constructor(contentElement, defaultPage, ...navigationElements) {

        // hold ref to the element that each page will 
        // be rendered
        if (contentElement == null) {
            throw new Error("undefined contentElement")
        }
        this.contentElement = contentElement

        // add pages to our PageNavigation
        this.pageMap = new Map()

        let homePage = new HomePage();
        this.pageMap.set(homePage.pageId, homePage);

        let searchPage = new SearchPage();
        this.pageMap.set(searchPage.pageId, searchPage);

        let recommendationsPage = new RecommendationsPage();
        this.pageMap.set(recommendationsPage.pageId, recommendationsPage);

        // wire onClick of navigationElements
        for (let navigationElement of navigationElements) {
            if (navigationElement == null) {
                throw new Error("undefined navigationElement");
            }

            const pageTarget = navigationElement.getAttribute("data-target");
            if (pageTarget == null) {
                throw new Error("undefined data-target in navigationElement");
            }

            if (pageTarget == defaultPage) {
                this.setActiveNavItem(navigationElement);
            }

            navigationElement.onclick = ((e) => {
                this.Navigate(e);
            });
        }

        this.selectedPage = this.pageMap.get(defaultPage);
        if (this.selectedPage == null) {
            return;
        }
        this.selectedPage.Load(contentElement);
    }

    /**
     * append class navselected to the Element that corresponds
     * to the ID of the Page that loaded
     * @param {Element} navItem 
     */
    setActiveNavItem(navItem) {
        navItem.classList.add("navselected");
    }

    /**
     * remove class navselected of the Element that corresponds
     * to the ID of the Page that unloaded
     */
    setInactiveNavItem() {
        let currentSelectedElement = document.querySelector(".navselected")
        if (currentSelectedElement != null) {
            currentSelectedElement.classList.remove("navselected");
        }
    }

    TriggerReload(pageId) {
        if (this.selectedPage.pageId !== pageId) {
            return;
        }

        this.selectedPage.UnLoad();
        this.contentElement.innerHTML = ``;
        this.selectedPage.Load(this.contentElement);
    }

    /**
     * Navigate to a Page
     * @param {Element} e 
     * @returns {null}
     */
    Navigate(e) {
        if (e.target == null || e.target.parentElement == null) {
            return;
        }

        let targetElement = e.target;

        let targetPage = e.target.getAttribute("data-target");
        if (targetPage == null) {
            targetPage = e.target.parentElement.getAttribute("data-target");
            if (targetPage == null) {
                return;
            }
            targetElement = targetElement.parentElement;
        }

        let actualPage = this.pageMap.get(targetPage);
        if (actualPage == null || actualPage.pageId == this.selectedPage.pageId) {
            return;
        }

        this.setInactiveNavItem();

        this.selectedPage.UnLoad();
        this.contentElement.innerHTML = ``;
        actualPage.Load(this.contentElement);
        this.setActiveNavItem(targetElement);
        this.selectedPage = actualPage;
    }

}

document.addEventListener('DOMContentLoaded', ((e) => {
    pageNavigation = new PageNavigation(
        document.querySelector("#pagecont"),
        "search",
        document.querySelector("#homeNav"),
        document.querySelector("#searchNav"),
        document.querySelector("#recommendNav")
    )
}))

