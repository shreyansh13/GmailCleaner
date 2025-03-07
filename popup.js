document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("openEmailPage").addEventListener("click", function () {
        chrome.tabs.create({ url: chrome.runtime.getURL("emails.html") });
    });
});