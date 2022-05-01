# Full Stack Web development - Semester Project 

## Paraskevi Tserpe (itp21117)

## Folder Structure Overview
- index.html: HTML code of the project
- index.js: JavaScript code of the project.
- style.css: CSS code of the project. 
- css/fonts folders: CSS code and fonts used only for icon visuals in the project.

## Project Description
The single-page app is divided into 3 Page and is responsive to many different form factors:
- Home Page: shows all of the user rated movies.
- Search Page: the user can search and rate for movies. 
- Recommendations Page: based on existing rated movies and by applying a Pearson Corelation factor, proposes new movies that the user might like.

## Optimizations
* wait for the user to finish typing (1 sec) before searching the API for movies (preventing search bursts)
* bottom pagination for movie search results (preventing UI freezing for large number of results)


## Code Assumptions
* Bad movie entries from the API start with " in the title which expands through out the genres as well.
* Render movies in Search Page in chunks of 100 items
* Deem another user correlated with local user when the Pearson Correlation factor is higher than 0.75
* Select only 40 movies from the correlated user that have a rating higher or equal to 4 and are not already rated by the local user.