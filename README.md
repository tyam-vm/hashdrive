# `Hashdrive`
Admin can upload a jpeg image of the certificate, a hash is computed of the image data and used to 
regester it as a valid certificate on ICP blockchain. Concerned party can verify the 
## What this project can do
* The ADMIN can register image of certificate
* Any third part who has logged in by Internet Identiy can Verify the image of certificate
## Running the project locally

If you want to test your project locally, you can use the following commands:

```bash
# Starts the replica, running in the background
dfx start --background

# Deploys your canisters to the replica and generates your candid interface
dfx deploy
```
## other helpful commands
```bash
cd Hashdrive/
dfx help
dfx canister --help
```
## dependencies:
* Node.js 19.0.0+
* rustc
* dfx
* cargo

# HOW TO USE

## How to register certificates?
You need to be admin to register certificates
Step1:- ```bash dfx deploy```
Step2:- you need you Principal Id

to get you principal Id open frontend link from dfx deploy. Login and your ID is there in the console.log

Step3:- paste your Principle Id string at HASHDRIVE/src/Hashdrive_backend/main.mo at line 19. atlast SAVE THE FILE 

Step4:- ```bash dfx deploy``` and open the frontend-link, you are a ADMIN now.

## How can you verify the certificates?
Step1:- ```bash dfx deploy```
Step2:- open the frontend link and login
Step3:- upload a photo and click the verify button.

# demo Deployed Canisters
URLs:
  Frontend canister via browser:
    Hashdrive_frontend: https://nq4km-riaaa-aaaam-aehma-cai.icp0.io/
  Backend canister via Candid interface:
    Hashdrive_backend: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=m5soc-6aaaa-aaaam-aehlq-cai
## Resouces & Ideas
* [Environment Setup Guide](https://docs.google.com/document/d/1MhzCf3wdxwpn2uAcdQmS7SEbljEgNFYvh3ADyZjb84o/)
* [RoadMap](https://docs.google.com/document/d/1KHmEFO6E9QjQBNEbDAV-hEF7iu5hPSUC9PZMSLZYPHE)
* [Ideas](https://docs.google.com/document/d/1dCViagnQEY1seT4pFQnwPzrBvcjoH3GJn3CG-3hWy7U/)
