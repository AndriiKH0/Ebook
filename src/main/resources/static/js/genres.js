document.addEventListener("DOMContentLoaded", function () {
    let tooltip = document.getElementById("genre-tooltip");

    window.showTooltip = function (event, element) {
        let genres = element.getAttribute("data-genres");
        if (!genres) return;

        tooltip.innerText = "Genres: " + genres;
        tooltip.style.display = "block";

        let tooltipWidth = tooltip.offsetWidth;
        let tooltipHeight = tooltip.offsetHeight;
        let pageWidth = window.innerWidth;
        let pageHeight = window.innerHeight;
        let mouseX = event.pageX;
        let mouseY = event.pageY;


        let left = mouseX + 10;
        if (left + tooltipWidth > pageWidth) {
            left = mouseX - tooltipWidth - 10;
        }

        let top = mouseY + 10;
        if (top + tooltipHeight > pageHeight) {
            top = mouseY - tooltipHeight - 10;
        }

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
        tooltip.classList.add("show");
    };

    window.hideTooltip = function () {
        tooltip.classList.remove("show");
        setTimeout(() => {
            tooltip.style.display = "none";
        }, 200);
    };
});
