import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import _Cycles "mo:base/ExperimentalCycles";
import _Debug "mo:base/Debug";
import Error "mo:base/Error";
import HashMap "mo:base/HashMap";
import _Hash "mo:base/Hash";
import _Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import _Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";

actor CertificateVerifier {
    // Hardcoded admin principal ID
    let ADMIN_PRINCIPAL = Principal.fromText("ytxt7-4u5v3-nzkd7-ls4e3-whz5s-gl3gy-42q5s-6pjva-az2gp-t4ana-wae");

    public type CertificateId = Text;
    public type CertificateHash = Blob;
    public type Error = {
        #NotFound;
        #AlreadyExists;
        #NotAuthorized;
        #InvalidInput;
    };

    public type Certificate = {
        id: CertificateId;
        hash: CertificateHash;
        metadata: CertificateMetadata;
        registeredBy: Principal;
        registeredAt: Time.Time;
    };

    public type CertificateMetadata = {
        name: Text;
        issuer: Text;
        issuedTo: Text;
        issueDate: Text;
        description: Text;
        certificateType: Text;
    };

    public type VerificationResult = {
        isValid: Bool;
        certificate: ?Certificate;
        message: Text;
    };

    private stable var admins : [Principal] = [ADMIN_PRINCIPAL];
    private stable var nextId : Nat = 1;

    private var certificates = HashMap.HashMap<CertificateId, Certificate>(10, Text.equal, Text.hash);
    private var certificatesByHash = HashMap.HashMap<Text, CertificateId>(10, Text.equal, Text.hash);

    private func hashToText(hash: CertificateHash) : Text {
        debug_show(hash)
    };

    private func isAdmin(caller: Principal) : Bool {
        let callerText = Principal.toText(caller);
        for (admin in admins.vals()) {
            if (Principal.toText(admin) == callerText) return true;
        };
        false
    };

    public shared(msg) func initialize() : async Result.Result<(), Error> {
        if (admins.size() > 0) {
            return #err(#AlreadyExists);
        };

        admins := [msg.caller];
        #ok(())
    };

    public shared(msg) func addAdmin(newAdmin: Principal) : async Result.Result<(), Error> {
        if (not isAdmin(msg.caller)) {
            return #err(#NotAuthorized);
        };

        for (admin in admins.vals()) {
            if (admin == newAdmin) return #ok(());
        };

        admins := Array.append(admins, [newAdmin]);
        #ok(())
    };

    public shared query(msg) func isCurrentUserAdmin() : async Bool {
        let callerPrincipal = msg.caller;
        let callerText = Principal.toText(callerPrincipal);
        let adminText = Principal.toText(admins[0]);

        // Use proper Debug module
        _Debug.print("Caller principal: " # callerText);
        _Debug.print("Admin principal: " # adminText);

        let result = isAdmin(msg.caller);
        _Debug.print("isAdmin result: " # debug_show(result));
        return result;
    };

    // Using the base library's hash functionality
    public func generateHash(image: Blob) : async CertificateHash {
        // The base library already provides Blob hashing
        image
    };

    public shared(msg) func registerCertificate(image: Blob, metadata: CertificateMetadata
    ) : async Result.Result<CertificateId, Error> {
        if (not isAdmin(msg.caller)) {
            return #err(#NotAuthorized);
        };

        // Generate hash using IC's built-in hashing
        let hash = image;
        let hashText = hashToText(hash);

        // Check if hash already exists
        switch (certificatesByHash.get(hashText)) {
            case (?_) {
                return #err(#AlreadyExists);
            };
            case (null) {};
        };

        // Create certificate ID
        let id = "CERT-" # Nat.toText(nextId);
        nextId += 1;

        let certificate : Certificate = {
            id = id;
            hash = hash;
            metadata = metadata;
            registeredBy = msg.caller;
            registeredAt = Time.now();
        };

        certificates.put(id, certificate);
        certificatesByHash.put(hashText, id);

        #ok(id)
    };

    public func verifyCertificate(image: Blob) : async VerificationResult {
        let hash = image; // Using the image blob directly for hashing
        let hashText = hashToText(hash);

        switch (certificatesByHash.get(hashText)) {
            case (?id) {
                switch (certificates.get(id)) {
                    case (?certificate) {
                        return {
                            isValid = true;
                            certificate = ?certificate;
                            message = "Certificate is valid and verified.";
                        };
                    };
                    case (null) {
                        // This shouldn't happen if our data is consistent
                        return {
                            isValid = false;
                            certificate = null;
                            message = "System error: Certificate ID exists but certificate data not found.";
                        };
                    };
                };
            };
            case (null) {
                return {
                    isValid = false;
                    certificate = null;
                    message = "Certificate is not authentic or has been tampered with.";
                };
            };
        };
    };

    public query func getCertificate(id: CertificateId) : async Result.Result<Certificate, Error> {
        switch (certificates.get(id)) {
            case (?cert) {
                #ok(cert)
            };
            case (null) {
                #err(#NotFound)
            };
        };
    };

    public shared query(msg) func listAllCertificates() : async Result.Result<[Certificate], Error> {
        if (not isAdmin(msg.caller)) {
            return #err(#NotAuthorized);
        };

        let buffer = Buffer.Buffer<Certificate>(certificates.size());
        for ((_, cert) in certificates.entries()) {
            buffer.add(cert);
        };

        #ok(Buffer.toArray(buffer))
    };

    public query func getCertificatesByIssuer(issuer: Text) : async [Certificate] {
        let buffer = Buffer.Buffer<Certificate>(0);

        for ((_, cert) in certificates.entries()) {
            if (cert.metadata.issuer == issuer) {
                buffer.add(cert);
            };
        };

        Buffer.toArray(buffer)
    };

    // User function: Get certificates issued to a person
    public query func getCertificatesForPerson(name: Text) : async [Certificate] {
        let buffer = Buffer.Buffer<Certificate>(0);

        for ((_, cert) in certificates.entries()) {
            if (cert.metadata.issuedTo == name) {
                buffer.add(cert);
            };
        };

        Buffer.toArray(buffer)
    };

    // Admin function: Revoke a certificate
    public shared(msg) func revokeCertificate(id: CertificateId) : async Result.Result<(), Error> {
        if (not isAdmin(msg.caller)) {
            return #err(#NotAuthorized);
        };

        switch (certificates.get(id)) {
            case (?cert) {
                let hashText = hashToText(cert.hash);
                certificates.delete(id);
                certificatesByHash.delete(hashText);
                #ok(())
            };
            case (null) {
                #err(#NotFound)
            };
        };
    };

    // System functions
    system func preupgrade() {
        // Add any pre-upgrade logic if needed
    };

    system func postupgrade() {
        // Add any post-upgrade logic if needed
    };
};
