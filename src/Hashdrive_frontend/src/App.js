import { html, render } from 'lit-html';
import { Hashdrive_backend as CertificateVerifier } from '../../declarations/Hashdrive_backend/index';
import { AuthClient } from "@dfinity/auth-client";
import logo from './logo2.svg';
//ok
class App {
  // State variables
  addIsOpen = false;
  
  checkIsOpen = false;
  isAdmin = false;
  authClient = null;
  actor = null;
  currentView = 'login';
  alertMessage = null;
  alertType = null;
  certificates = [];
  verificationResult = null;

  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      this.authClient = await AuthClient.create();
      
      if (await this.authClient.isAuthenticated()) {
        await this.handleAuthenticated();
      } else {
        this.currentView = 'login';
      }
    } catch (error) {
      this.showAlert('Authentication initialization failed', 'error');
    }
    this.#render();
  }
  
  async login() {
    try {
      await this.authClient.login({
        identityProvider: "https://identity.ic0.app",
        onSuccess: async () => {
          await this.handleAuthenticated();
          this.showAlert('Login successful!', 'success');
        },
        windowOpenerFeatures: `
          width=500,
          height=600,
          toolbar=0,
          scrollbars=1,
          status=1,
          resizable=1,
          location=1,
          menuBar=0
        `
      });
    } catch (error) {
      this.showAlert('Login canceled or failed', 'error');
    }
  }
  
  async logout() {
    await this.authClient.logout();
    this.actor = null;
    this.isAdmin = false;
    this.currentView = 'login';
    this.#render();
  }
  
  async handleAuthenticated() {
    const identity = this.authClient.getIdentity();
    this.actor = CertificateVerifier;
    
    try {
        // Log your principal ID
        const principal = identity.getPrincipal().toString();
        console.log("Your Principal ID:", principal);
        this.showAlert(`Your Principal ID: ${principal}`, "info");
        
        // Use the dedicated admin check function
        this.isAdmin = await this.actor.isCurrentUserAdmin();
        console.log("Admin check result:", this.isAdmin);
        
        if (this.isAdmin) {
            console.log("The Admin has descended");
            this.currentView = 'admin';
        } else {
            this.currentView = 'verify';
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        this.isAdmin = false;
        this.currentView = 'verify';
    }
    this.#render();
}
  
    // Add to App class
  async checkAdminStatus() {
    try {
      this.isAdmin = await this.actor.isCurrentUserAdmin();
      this.currentView = this.isAdmin ? 'admin' : 'verify';
    } catch (error) {
      console.error("Admin check failed:", error);
      this.currentView = 'verify';
    }
    this.#render();
  }


  showView(view) {
    this.currentView = view;
    this.#render();
  }
  
  // Certificate Management Functions
  
  async registerCertificate(event) {
    event.preventDefault();
    
    if (!this.isAdmin) {
      this.showAlert("Only admins can register certificates", "error");
      return;
    }
    
    const form = event.target;
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput.files[0];
    
    if (!file) {
      this.showAlert("Please select a certificate image", "error");
      return;
    }
    
    try {
      // Read the file as ArrayBuffer
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      
      // Convert to Blob for Motoko
      const certificateBlob = new Uint8Array(arrayBuffer);
      
      // Get metadata from form
      const metadata = {
        name: form.querySelector('#certificate-name').value,
        issuer: form.querySelector('#certificate-issuer').value,
        issuedTo: form.querySelector('#certificate-issued-to').value,
        issueDate: form.querySelector('#certificate-issue-date').value,
        description: form.querySelector('#certificate-description').value,
        certificateType: form.querySelector('#certificate-type').value,
      };
      
      // Call the canister
      const result = await this.actor.registerCertificate(certificateBlob, metadata);
      
      if ("ok" in result) {
        this.showAlert(`Certificate registered with ID: ${result.ok}`, "success");
        form.reset();
      } else {
        this.showAlert(`Error: ${Object.keys(result.err)[0]}`, "error");
      }
    } catch (error) {
      console.error("Error registering certificate:", error);
      this.showAlert("Failed to register certificate", "error");
    }
  }
  
  async verifyCertificate(event) {
    event.preventDefault();
    
    const form = event.target;
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput.files[0];
    
    if (!file) {
      this.showAlert("Please select a certificate image to verify", "error");
      return;
    }
    
    try {
      // Read the file as ArrayBuffer
      const arrayBuffer = await this.readFileAsArrayBuffer(file);
      
      // Convert to Blob for Motoko
      const certificateBlob = new Uint8Array(arrayBuffer);
      
      // Call the canister
      const result = await this.actor.verifyCertificate(certificateBlob);
      
      // Display the result
      this.verificationResult = result;
      this.currentView = 'results';
      this.#render();
    } catch (error) {
      console.error("Error verifying certificate:", error);
      this.showAlert("Failed to verify certificate", "error");
    }
  }
  
  async listAllCertificates() {
    if (!this.isAdmin) {
      this.showAlert("Only admins can view all certificates", "error");
      return;
    }
    
    try {
      const result = await this.actor.listAllCertificates();
      
      if ("ok" in result) {
        this.certificates = result.ok;
        this.currentView = 'certificatesList';
        this.#render();
      } else {
        this.showAlert(`Error: ${Object.keys(result.err)[0]}`, "error");
      }
    } catch (error) {
      console.error("Error listing certificates:", error);
      this.showAlert("Failed to retrieve certificates", "error");
    }
  }
  
  async revokeCertificate(id) {
    if (!this.isAdmin) {
      this.showAlert("Only admins can revoke certificates", "error");
      return;
    }
    
    try {
      const result = await this.actor.revokeCertificate(id);
      
      if ("ok" in result) {
        this.showAlert(`Certificate ${id} has been revoked`, "success");
        // Refresh the list
        this.listAllCertificates();
      } else {
        this.showAlert(`Error: ${Object.keys(result.err)[0]}`, "error");
      }
    } catch (error) {
      console.error("Error revoking certificate:", error);
      this.showAlert("Failed to revoke certificate", "error");
    }
  }
  
  // Helper Functions
  
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  
  showAlert(message, type='info') {
    this.alertMessage = message;
    this.alertType = type;
    this.#render();
    
    //alert is deleted after 5 sec
    setTimeout(() => {
      this.alertMessage = null;
      this.#render();
    }, 5000);
  }

  #setupEventListeners() {
    // Setup event listeners after rendering
    if (this.currentView === 'login') {
      document.getElementById('login-button')?.addEventListener('click', () => this.login());
    }
    
    if (this.currentView === 'admin') {
      document.getElementById('register-certificate-form')?.addEventListener('submit', (e) => this.registerCertificate(e));
      document.getElementById('view-all-certificates-button')?.addEventListener('click', () => this.listAllCertificates());
    }
    
    if (this.currentView === 'verify') {
      document.getElementById('verify-certificate-form')?.addEventListener('submit', (e) => this.verifyCertificate(e));
    }
    
    // Navigation buttons
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.showView(e.target.getAttribute('data-nav'));
      });
    });
    
    // Revoke buttons
    document.querySelectorAll('[data-revoke]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.revokeCertificate(e.target.getAttribute('data-revoke'));
      });
    });
  }

  #render() {
    // Alert message
    const alertTemplate = this.alertMessage ? html`
      <div class="alert alert-${this.alertType}" role="alert">
        ${this.alertMessage}
      </div>
    ` : '';
    
    // Navigation
    const navTemplate = this.authClient?.isAuthenticated() ? html`
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
          <a class="navbar-brand" href="#">Certificate Verifier</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto">
              ${this.isAdmin ? html`
                <li class="nav-item">
                  <a class="nav-link" href="#" data-nav="admin">Admin Panel</a>
                </li>
              ` : ''}
              <li class="nav-item">
                <a class="nav-link" href="#" data-nav="verify">Verify Certificate</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="#" @click=${() => this.logout()}>Logout</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    ` : '';
    
    // Main content based on current view
    let mainContent;
    
    switch (this.currentView) {
      case 'login':
        mainContent = html`
          <div class="card">
            <div class="card-body text-center">
              <h2 class="card-title mb-4">Welcome to Certificate Verification System</h2>
              <img src="${logo}" alt="Logo" class="mb-4" style="max-width: 200px;" />
              <p class="card-text mb-4">This system allows you to verify the authenticity of digital certificates.</p>
              <button id="login-button" class="btn btn-primary">Login with Internet Identity</button>
            </div>
          </div>
        `;
        break;
        
      case 'admin':
        mainContent = html`
          <h2 class="mb-4">Admin Dashboard</h2>
          
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title">Register New Certificate</h3>
            </div>
            <div class="card-body">
              <form id="register-certificate-form">
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label for="certificate-name" class="form-label">Certificate Name</label>
                    <input type="text" class="form-control" id="certificate-name" required>
                  </div>
                  <div class="col-md-6">
                    <label for="certificate-type" class="form-label">Certificate Type</label>
                    <input type="text" class="form-control" id="certificate-type" required>
                  </div>
                </div>
                
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label for="certificate-issuer" class="form-label">Issuer</label>
                    <input type="text" class="form-control" id="certificate-issuer" required>
                  </div>
                  <div class="col-md-6">
                    <label for="certificate-issued-to" class="form-label">Issued To</label>
                    <input type="text" class="form-control" id="certificate-issued-to" required>
                  </div>
                </div>
                
                <div class="row mb-3">
                  <div class="col-md-6">
                    <label for="certificate-issue-date" class="form-label">Issue Date</label>
                    <input type="date" class="form-control" id="certificate-issue-date" required>
                  </div>
                  <div class="col-md-6">
                    <label for="certificate-file" class="form-label">Certificate Image</label>
                    <input type="file" class="form-control" id="certificate-file" accept="image/*" required>
                  </div>
                </div>
                
                <div class="mb-3">
                  <label for="certificate-description" class="form-label">Description</label>
                  <textarea class="form-control" id="certificate-description" rows="3" required></textarea>
                </div>
                
                <button type="submit" class="btn btn-success">Register Certificate</button>
              </form>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h3 class="card-title mb-0">Manage Certificates</h3>
              <button id="view-all-certificates-button" class="btn btn-primary">View All Certificates</button>
            </div>
          </div>
        `;
        break;
        
      case 'verify':
        mainContent = html`
          <h2 class="mb-4">Verify Certificate</h2>
          
          <div class="card">
            <div class="card-body">
              <p>Upload a certificate image to verify its authenticity.</p>
              
              <form id="verify-certificate-form">
                <div class="mb-3">
                  <label for="verify-certificate-file" class="form-label">Certificate Image</label>
                  <input type="file" class="form-control" id="verify-certificate-file" accept="image/*" required>
                </div>
                
                <button type="submit" class="btn btn-primary">Verify Certificate</button>
              </form>
            </div>
          </div>
        `;
        break;
        
      case 'results':
        const result = this.verificationResult;
        
        mainContent = html`
          <h2 class="mb-4">Verification Results</h2>
          
          <div class="card">
            <div class="card-body">
              ${result.isValid ? 
                html`
                  <div class="alert alert-success">
                    <h4>✅ Certificate Verified</h4>
                    <p>${result.message}</p>
                  </div>
                  <div class="card mt-3">
                    <div class="card-header">
                      <h5>Certificate Details</h5>
                    </div>
                    <div class="card-body">
                      <p><strong>ID:</strong> ${result.certificate[0].id}</p>
                      <p><strong>Name:</strong> ${result.certificate[0].metadata.name}</p>
                      <p><strong>Issued By:</strong> ${result.certificate[0].metadata.issuer}</p>
                      <p><strong>Issued To:</strong> ${result.certificate[0].metadata.issuedTo}</p>
                      <p><strong>Issue Date:</strong> ${result.certificate[0].metadata.issueDate}</p>
                      <p><strong>Type:</strong> ${result.certificate[0].metadata.certificateType}</p>
                      <p><strong>Description:</strong> ${result.certificate[0].metadata.description}</p>
                    </div>
                  </div>
                ` : 
                html`
                  <div class="alert alert-danger">
                    <h4>❌ Verification Failed</h4>
                    <p>${result.message}</p>
                  </div>
                `
              }
            </div>
          </div>
          
          <button class="btn btn-secondary mt-3" data-nav="verify">
            Back to Verification
          </button>
        `;
        break;
        
      case 'certificatesList':
        mainContent = html`
          <h2 class="mb-4">All Certificates</h2>
          
          <div class="card">
            <div class="card-body">
              ${this.certificates.length === 0 ? 
                html`<div class="alert alert-info">No certificates found</div>` :
                html`
                  <div class="table-responsive">
                    <table class="table table-striped">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Issued To</th>
                          <th>Issuer</th>
                          <th>Issue Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.certificates.map(cert => html`
                          <tr>
                            <td>${cert.id}</td>
                            <td>${cert.metadata.name}</td>
                            <td>${cert.metadata.issuedTo}</td>
                            <td>${cert.metadata.issuer}</td>
                            <td>${cert.metadata.issueDate}</td>
                            <td>
                              <button class="btn btn-sm btn-danger" data-revoke="${cert.id}">
                                Revoke
                              </button>
                            </td>
                          </tr>
                        `)}
                      </tbody>
                    </table>
                  </div>
                `
              }
            </div>
          </div>
          
          <button class="btn btn-secondary mt-3" data-nav="admin">
            Back to Admin Panel
          </button>
        `;
        break;
    }
    
    // Full page template
    const template = html`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
      ${navTemplate}
      <div class="container mt-4">
        ${alertTemplate}
        ${mainContent}
      </div>
      <footer class="mt-5 py-3 bg-light text-center">
        <div class="container">
          <p>Certificate Verification System © 2025</p>
        </div>
      </footer>
    `;
    
    // Render to root element
    render(template, document.getElementById('root'));
    
    // Setup event listeners after rendering
    setTimeout(() => this.#setupEventListeners(), 0);
  }
}

export default App;