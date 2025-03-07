let promotionalEmails = [];
let nextPageToken = null;
let groupedEmails = {}; // Store emails grouped by sender

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startFetching") {
        fetchEmails(message.category || "promotions");
    } else if (message.action === "fetchMoreEmails") {
        fetchEmails(message.category || "promotions", true);
    }
});

function authenticateUser(callback) {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
            console.error("Auth Error:", chrome.runtime.lastError);
            return;
        }
        

        chrome.storage.local.set({ gmail_access_token: token }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error saving token:", chrome.runtime.lastError);
            } else {
                console.log("Access token saved successfully!");
            }
        });

        // localStorage.setItem("gmail_access_token", token);
        console.log("Access Token:", token);
        callback(token);
    });  
}

function unsubscribe(sender) {
    console.log("Unsubscribing from:", sender);
    // Implement the logic for unsubscribing
}

function fetchEmails(category = "promotions", loadMore = false, callback = null) {
    authenticateUser(async (token) => {

        showProgressBar();
        updateProgress(10);

        if (loadMore == false)
        {
            groupedEmails = {};
        }

        let totalFetched = 0;

        let url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=category:${category}&maxResults=500`;

        while (totalFetched < 500) {
            let requestUrl = nextPageToken ? `${url}&pageToken=${nextPageToken}` : url;

            try {
                const response = await fetch(requestUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                updateProgress(50);

                if (!response.ok) {
                    console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
                    setTimeout(() => {
                        console.log("Executed after 1 minute");
                    }, 60000);
                    continue;
                }

                const data = await response.json();

                updateProgress(80);

                if (!data.messages) {
                    console.log("No promotional emails found.");
                    return;
                }

                let emailPromises = data.messages.map(msg =>
                    fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then(res => res.json().then(email => ({ email, id: msg.id })))
                    .catch(err => console.error("Error fetching email:", err))
                );

                const emails = await Promise.all(emailPromises);

                emails.forEach(({ email, id }) => {
                    if (!email || !email.payload || !email.payload.headers) return;

                    const headers = email.payload.headers;
                    const sender = headers.find(h => h.name === "From")?.value || "Unknown Sender";
                    const subject = headers.find(h => h.name === "Subject")?.value || "No Subject";
                    const unsubscribeHeader = headers.find(h => h.name === "List-Unsubscribe")?.value || null;

                    let unsubscribeLink = null;
                    if (unsubscribeHeader) {
                        // Extract the URL or email from List-Unsubscribe
                        const match = unsubscribeHeader.match(/<(.*?)>/);
                        unsubscribeLink = match ? match[1] : unsubscribeHeader;
                    }

                    let emailLink = `https://mail.google.com/mail/u/0/#inbox/${id}`;

                    if (!groupedEmails[sender]) {
                        groupedEmails[sender] = { subjects: [], unsubscribe: unsubscribeLink };
                    }

                    groupedEmails[sender].subjects.push({ id, subject, link: emailLink });
                });

                totalFetched += emails.length;
                // Store next page token for future requests
                nextPageToken = data.nextPageToken || null;

                // Send grouped emails to popup
                chrome.runtime.sendMessage({ 
                    action: "updateEmails", 
                    emails: groupedEmails, 
                    hasMore: !!nextPageToken 
                });

                updateProgress(100); 

                if (!nextPageToken) {
                    console.log(`Fetched all available ${category} emails.`);
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 200));

                if (callback) {
                    callback({ emails: groupedEmails, hasMore: !!nextPageToken });
                }
            } catch (error) {
                console.error("Error fetching emails:", error);
            }

            // setTimeout(() => {
            //     console.log("Executed after 2 seconds");
            // }, 2000); // 2000 milliseconds = 2 seconds
        }

        console.log(`Fetched total of ${totalFetched} emails from ${category}.`);
    });


    function showProgressBar() {
        chrome.runtime.sendMessage({ action: "showProgress" });
    }
    
    // Send message to popup to update progress
    function updateProgress(value) {
        chrome.runtime.sendMessage({ action: "updateProgress", progress: value });
    }
    
    // Send message to popup to hide the progress bar
    function hideProgressBar() {
        chrome.runtime.sendMessage({ action: "hideProgress" });
    }
    
}
