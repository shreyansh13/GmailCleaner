document.addEventListener("DOMContentLoaded", function () {

    const startButton = document.getElementById("startFetching");   
    const emailsList = document.getElementById("emailsList");
    const loadMoreBtn = document.getElementById("loadMoreBtn");
    const emailCountDisplay = document.getElementById("emailCountDisplay");
    const deleteSelectedBtn = document.getElementById("deleteSelected");
    const resetBtn = document.getElementById("resetButton");
    const categoryList = document.getElementById("emailCategory");

    emailsList.innerHTML = "";
    loadMoreBtn.style.display = "inline-block";
    loadMoreBtn.disabled = true;
    emailCountDisplay.style.display = "none"; 
    emailCountDisplay.style.display = "none"; 

    startButton.addEventListener("click", startFetchingEmails);
    loadMoreBtn.addEventListener("click", fetchMoreEmails);
    deleteSelectedBtn.addEventListener("click", deleteSelectedEmails);
    resetBtn.addEventListener("click", resetEverything);
    categoryList.addEventListener("click", resetEverything);    

     // Handle incoming messages
     chrome.runtime.onMessage.addListener((message) => {
        switch (message.action) {
            case "showProgress":
                document.getElementById("progress-container").style.display = "block";
                break;
            case "updateProgress":
                document.getElementById("progress-bar").style.width = message.progress + "%";
                break;
            case "hideProgress":
                document.getElementById("progress-container").style.display = "none";
                break;
            case "updateEmails":
                updateEmailList(message.emails, message.hasMore);
                document.getElementById("progress-container").style.display = "none";
                break;
        }
    });

    function resetEverything() {

        emailsList.innerHTML = "";        
        emailCountDisplay.style.display = "none";
        loadMoreBtn.disabled = true;
        startButton.disabled = false;
        loadMoreBtn.style.display = "inline-block";
        startButton.style.display = "inline-block";
        const emptyMessage = document.createElement("div");
        emptyMessage.innerHTML = `
            <p style="color: #666; font-size: 16px; text-align: center; margin-top: 20px;">
                📭 No emails found!<br>Try start fetching.
            </p>
        `;
        emailsList.appendChild(emptyMessage);        
    }

    function startFetchingEmails() {
        emailsList.textContent = "";
        emailCountDisplay.style.display = "block";
        startButton.disabled = true;
        loadMoreBtn.disabled = true;
        loadMoreBtn.style.display = "inline-none";
        const selectedCategory = document.getElementById("emailCategory").value;
        chrome.runtime.sendMessage({ 
            action: "startFetching", 
            category: selectedCategory
        });
    }

    function fetchMoreEmails() {
        chrome.runtime.sendMessage({ action: "fetchMoreEmails" });
    }

    function updateEmailList(emails, hasMore) {

        emailsList.innerHTML = "";

        if (Object.keys(emails).length === 0) {
            emailsList.innerHTML = `<p class="no-emails">📭 No emails found in this category.</p>`;
            return;
        }
        // if (!emails || Object.keys(emails).length === 0) return;
        
        let newEmailCount = 0;
        
        Object.entries(emails)
            .sort((a, b) => b[1].subjects.length - a[1].subjects.length)
            .forEach(([sender, data]) => {
                const senderDiv = document.createElement("div");
                senderDiv.classList.add("sender-group");

                const emailCount = data.subjects.length;
                newEmailCount += emailCount;

                const selectAllCheckbox = document.createElement("input");
                selectAllCheckbox.type = "checkbox";
                selectAllCheckbox.classList.add("select-all-checkbox");

                const unsubscribeLink = document.createElement("a");
                if (data.unsubscribe) {
                    unsubscribeLink.href = data.unsubscribe;
                    unsubscribeLink.textContent = "Unsubscribe";
                    unsubscribeLink.classList.add("unsubscribe-link");
                    unsubscribeLink.target = "_blank";
                } else {
                    unsubscribeLink.textContent = "(No unsubscribe link found)";
                    unsubscribeLink.style.color = "gray";
                }

                const toggleButton = document.createElement("span");
                toggleButton.classList.add("toggle");
                toggleButton.textContent = "[+]";

//                senderDiv.innerHTML = `<strong>${sender}</strong> (${emailCount} emails) <span class="toggle">[+]</span>`;

                senderDiv.append(selectAllCheckbox, ` ${sender} (${emailCount} emails) `, toggleButton, unsubscribeLink);

                // senderDiv.prepend(selectAllCheckbox);
                // senderDiv.appendChild(unsubscribeLink);

                const emailList = document.createElement("ul");
                emailList.style.display = "none";
                
                data.subjects.forEach(subject => {
                    const emailItem = document.createElement("li");
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.value = subject.id;
                    checkbox.classList.add("email-checkbox");

                    const emailLink = document.createElement("a");
                    emailLink.href = subject.link;
                    emailLink.target = "_blank";
                    emailLink.textContent = subject.subject;

                    emailItem.appendChild(checkbox);
                    emailItem.appendChild(emailLink);
                    emailList.appendChild(emailItem);
                });

                senderDiv.addEventListener("click", () => {
                    const isHidden = emailList.style.display === "none";
                    emailList.style.display = isHidden ? "block" : "none";
                    toggleButton.textContent = isHidden ? "[-]" : "[+]";
                });

                selectAllCheckbox.addEventListener("change", function () {
                    emailList.querySelectorAll(".email-checkbox").forEach(cb => cb.checked = this.checked);
                });

                emailsList.appendChild(senderDiv);
                emailsList.appendChild(emailList);
            });

            // Update Email Count Display
            emailCountDisplay.style.display = "block";
            emailCountDisplay.textContent = `New emails loaded: ${newEmailCount}`;

            // Load More Button
            loadMoreBtn.disabled = false;
            loadMoreBtn.style.display = hasMore ? "inline-block" : "none";
    }
    
    

    function deleteSelectedEmails() {
        const selectedEmails = Array.from(document.querySelectorAll(".email-checkbox:checked"))
            .map(checkbox => checkbox.value);

        if (selectedEmails.length === 0) {
            alert("Please select emails to delete.");
            return;
        }

        chrome.storage.local.get(["gmail_access_token"], async (result) => {
            const accessToken = result.gmail_access_token;
            if (!accessToken) {
                alert("No access token found. Please authenticate.");
                return;
            }

            await moveToTrash(accessToken, selectedEmails);
            alert(`${selectedEmails.length} emails moved to trash.`);                   
            chrome.runtime.sendMessage({ action: "startFetching" });
        });
    }

    async function moveToTrash(accessToken, selectedEmails) {
        for (let id of selectedEmails) {
            const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ addLabelIds: ["TRASH"], removeLabelIds: [] })
            });
            if (!response.ok) {
                console.error("Error moving email to trash", await response.json());
            }
        }
    }

    
});