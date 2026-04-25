import { db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById('verify-form');
    const input = document.getElementById('certId');
    const btn = document.getElementById('verify-submit');
    const spinner = document.getElementById('loading-spinner');
    
    const resultContainer = document.getElementById('result-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    // Auto-fill from URL param if present
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');
    if (urlId) {
        input.value = urlId;
        verifyCertificate(urlId);
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = input.value.trim().toUpperCase();
        if (id) {
            verifyCertificate(id);
        }
    });
    
    async function verifyCertificate(id) {
        // Reset state
        resultContainer.style.display = 'none';
        errorContainer.style.display = 'none';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        spinner.style.display = 'flex';
        
        // Update URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('id', id);
        window.history.pushState({}, '', newUrl);
        
        try {
            const ref = doc(db, 'certificates', id);
            const snap = await getDoc(ref);
            
            if (snap.exists()) {
                const data = snap.data();
                
                document.getElementById('res-name').textContent = data.name || 'Student';
                document.getElementById('res-course').textContent = data.courseName || data.courseId;
                
                const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
                const dateStr = data.issuedAt && data.issuedAt.toDate ? data.issuedAt.toDate().toLocaleDateString('en-US', dateOpts) : new Date().toLocaleDateString('en-US', dateOpts);
                
                document.getElementById('res-date').textContent = dateStr;
                document.getElementById('res-id').textContent = id;
                
                resultContainer.style.display = 'block';
            } else {
                errorMessage.textContent = `No certificate found with ID: ${id}`;
                errorContainer.style.display = 'block';
            }
        } catch (err) {
            console.error("Verification failed:", err);
            errorMessage.textContent = "An error occurred while verifying the certificate. Please try again.";
            errorContainer.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.style.opacity = '1';
            spinner.style.display = 'none';
        }
    }
});
